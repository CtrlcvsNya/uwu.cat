/**
 * 仅处理 /media/* 视频的 Range 请求（见 wrangler.jsonc 的 run_worker_first）。
 * Workers 静态资源本身不返回 206，而 Safari / iOS 播放 <video> 必须要 Range 支持。
 * 其余所有请求都直接由静态资源响应，不经过这里。
 *
 * 注意：ASSETS 返回的是流式响应，既没有 Content-Length 也不理会 Range，
 * 所以文件大小来自部署时生成的 media-sizes.json（scripts/media-sizes.mjs）。
 */
import mediaSizes from "./media-sizes.json";

const SIZES: Record<string, number> = mediaSizes;
interface Env {
    ASSETS: { fetch(req: Request | string): Promise<Response> };
}

function parseRange(header: string, size: number): [number, number] | null {
    const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!m || (m[1] === "" && m[2] === "")) return null;
    let start: number, end: number;
    if (m[1] === "") {
        // bytes=-N：最后 N 个字节
        start = Math.max(0, size - Number(m[2]));
        end = size - 1;
    } else {
        start = Number(m[1]);
        end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    return start <= end && start < size ? [start, end] : null;
}

/** 只透传 [start, end] 区间的字节，读到 end 后立即停止上游 */
function sliceStream(body: ReadableStream<Uint8Array>, start: number, end: number) {
    const reader = body.getReader();
    let pos = 0;
    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            // 必须循环到真正 enqueue 或结束为止：pull 不入队就返回的话，流不会再次调用 pull
            for (;;) {
                const {done, value} = await reader.read();
                if (done) return controller.close();
                const chunkStart = pos;
                pos += value.byteLength;
                if (pos <= start) continue; // 整块都在区间之前，跳过
                const from = Math.max(0, start - chunkStart);
                const to = Math.min(value.byteLength, end + 1 - chunkStart);
                if (to > from) controller.enqueue(value.subarray(from, to));
                if (pos > end) {
                    controller.close();
                    await reader.cancel();
                }
                return;
            }
        },
        cancel() {
            return reader.cancel();
        },
    });
}

const handler = {
    async fetch(request: Request, env: Env): Promise<Response> {
        const range = request.headers.get("Range");
        // 去掉 Range 头取完整资源
        const res = await env.ASSETS.fetch(request.url);
        const size = SIZES[new URL(request.url).pathname];
        if (!res.ok || !res.body || !size) return res;

        const headers = new Headers(res.headers);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Content-Length", String(size));
        if (!range || request.method !== "GET") {
            return new Response(request.method === "HEAD" ? null : res.body, {status: 200, headers});
        }

        const r = parseRange(range, size);
        if (!r) {
            await res.body.cancel();
            headers.set("Content-Range", `bytes */${size}`);
            headers.delete("Content-Length");
            return new Response(null, {status: 416, headers});
        }
        const [start, end] = r;
        headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
        headers.set("Content-Length", String(end - start + 1));
        return new Response(sliceStream(res.body, start, end), {status: 206, headers});
    },
};

export default handler;

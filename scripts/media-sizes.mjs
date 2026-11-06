// 部署前生成 worker/media-sizes.json：记录 out/media 下每个文件的字节数。
// Workers 的 ASSETS 绑定返回的是流式响应（没有 Content-Length），Worker 要靠它来计算 Range。
import {readdirSync, statSync, writeFileSync} from "node:fs";
import {join} from "node:path";

const dir = "out/media";
const sizes = {};
for (const name of readdirSync(dir)) {
    const st = statSync(join(dir, name));
    if (st.isFile()) sizes[`/media/${name}`] = st.size;
}
writeFileSync("worker/media-sizes.json", JSON.stringify(sizes, null, 2) + "\n");
console.log("media sizes:", sizes);

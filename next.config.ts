import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    // 导出成静态文件
    output: 'export',
    images: {
        unoptimized: true,
    },
}

export default nextConfig

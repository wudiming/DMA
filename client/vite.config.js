import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
    plugins: [react()],
    // 将 package.json 版本号注入为全局常量，构建时替换
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version)
    },
    server: {
        host: '0.0.0.0',
        port: 3000,
        proxy: {
            '/api': {
                target: process.env.API_TARGET || 'http://localhost:3001',
                changeOrigin: true
            },
            '/ws': {
                target: (process.env.API_TARGET || 'http://localhost:3001').replace('http', 'ws'),
                ws: true,
                changeOrigin: true
            }
        }
    },
    build: {
        sourcemap: false
    }
})

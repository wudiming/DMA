import express from 'express';
import cors from 'cors';
import http from 'http';

export function startAgent() {
    const AGENT_PORT = process.env.AGENT_PORT || 9002;
    const SECRET = process.env.DMA_SECRET;

    if (!SECRET) {
        console.error('Error: DMA_SECRET environment variable is required in agent mode.');
        process.exit(1);
    }

    const agentApp = express();
    agentApp.use(cors());

    // 验证中间件
    agentApp.use((req, res, next) => {
        // Support both headers for compatibility
        const clientSecret = req.headers['x-agent-secret'] || req.headers['x-dma-secret'];

        if (clientSecret !== SECRET) {
            console.log(`Unauthorized agent access attempt from ${req.ip}`);
            return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
        }
        next();
    });

    // 代理所有请求到 Docker Socket
    agentApp.all('*', (req, res) => {
        const options = {
            socketPath: '/var/run/docker.sock',
            path: req.url,
            method: req.method,
            headers: { ...req.headers }
        };

        // 移除主机头，避免 Docker 误判
        delete options.headers['host'];
        delete options.headers['connection'];
        delete options.headers['content-length'];

        const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Docker socket proxy error', details: err.message });
            }
        });

        req.pipe(proxyReq);
    });

    const server = agentApp.listen(AGENT_PORT, () => {
        console.log(`DMA Agent running on port ${AGENT_PORT}`);
        console.log(`Secret: ${SECRET.substring(0, 3)}***${SECRET.substring(SECRET.length - 3)}`);
    });

    // 处理 WebSocket 升级请求
    server.on('upgrade', (req, socket, head) => {
        // 验证 Secret
        const clientSecret = req.headers['x-agent-secret'] || req.headers['x-dma-secret'];
        if (clientSecret !== SECRET) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        const proxyHeaders = { ...req.headers };
        // Ensure upgrade headers are passed
        if (req.headers['upgrade']) proxyHeaders['upgrade'] = req.headers['upgrade'];
        if (req.headers['connection']) proxyHeaders['connection'] = req.headers['connection'];

        // Remove host header to avoid Docker misinterpretation
        delete proxyHeaders['host'];
        delete proxyHeaders['content-length'];

        const proxyReq = http.request({
            socketPath: '/var/run/docker.sock',
            path: req.url,
            method: req.method,
            headers: proxyHeaders
        });

        proxyReq.on('response', (proxyRes) => {
            // Docker often returns 200 OK for hijacked TCP connections (Upgrade: tcp)
            // In this case, we need to hijack the socket manually if it's not a standard upgrade
            if (proxyRes.statusCode === 200 && req.headers['upgrade'] === 'tcp') {
                socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                    'Upgrade: tcp\r\n' +
                    'Connection: Upgrade\r\n\r\n');

                proxyRes.pipe(socket);
                socket.pipe(proxyRes);
                return;
            }

            // For non-upgrade responses, just pipe it back
            console.error('[Agent] Upstream did not upgrade as expected. Status:', proxyRes.statusCode);
            socket.end();
        });

        proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
            // Construct response headers from upstream
            let responseHeaders = 'HTTP/1.1 101 Switching Protocols\r\n';
            if (proxyRes.headers['upgrade']) {
                responseHeaders += `Upgrade: ${proxyRes.headers['upgrade']}\r\n`;
            }
            if (proxyRes.headers['connection']) {
                responseHeaders += `Connection: ${proxyRes.headers['connection']}\r\n`;
            }
            responseHeaders += '\r\n';

            socket.write(responseHeaders);

            proxySocket.pipe(socket);
            socket.pipe(proxySocket);
        });

        proxyReq.on('error', (err) => {
            console.error('WebSocket proxy error:', err);
            socket.end();
        });

        proxyReq.end();
    });
}

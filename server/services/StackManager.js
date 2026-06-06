import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';

/**
 * StackManager handles all Docker Compose operations for stacks.
 * It unifies execution logic for local and remote endpoints.
 */
export class StackManager {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.stacksDir = path.join(dataDir, 'compose', 'stacks');
    }

    /**
     * Execute a Docker Compose command.
     * @param {string} command - The compose command (e.g., 'up -d', 'down').
     * @param {string} stackDir - The directory containing the docker-compose.yml.
     * @param {object} endpoint - The endpoint configuration.
     * @param {string} stackName - The name of the stack (used for -p project name).
     * @param {function} onLog - Callback for stdout/stderr logs.
     * @param {array} envVars - Optional array of {name, value} environment variables.
     */
    async executeCompose(command, stackDir, endpoint, stackName, onLog, envVars = []) {
        const isRemote = endpoint && endpoint.type === 'agent';
        let proxyServer = null;
        let env = { ...process.env };

        // Ensure stackName is provided to prevent "ghost" stacks
        if (!stackName) {
            throw new Error('Stack name is required for execution');
        }

        // Inject stack environment variables
        if (envVars && Array.isArray(envVars)) {
            envVars.forEach(({ name, value }) => {
                if (name && value !== undefined) {
                    env[name] = value;
                }
            });
            if (onLog && envVars.length > 0) {
                onLog(`[StackManager] Injected ${envVars.length} environment variable(s)`);
            }
        }

        try {
            // Setup remote access if needed
            if (isRemote) {
                const proxy = await this.createAgentProxy(endpoint);
                proxyServer = proxy.server;
                env.DOCKER_HOST = `tcp://127.0.0.1:${proxy.port}`;
                if (onLog) onLog(`[StackManager] Using remote agent proxy on port ${proxy.port}`);
            }

            // Construct arguments
            // ALWAYS enforce project name with -p
            const args = ['compose', '-p', stackName, '-f', 'docker-compose.yml'];

            // Add command parts
            const cmdParts = command.split(' ');
            args.push(...cmdParts);

            if (onLog) onLog(`[StackManager] Executing: docker ${args.join(' ')}`);

            console.log(`[StackManager] Executing: docker ${args.join(' ')}`);
            console.log(`[StackManager] CWD: ${stackDir}`);
            console.log(`[StackManager] Endpoint: ${endpoint ? endpoint.type : 'local'} (${endpoint ? endpoint.ip : '-'})`);
            if (env.DOCKER_HOST) console.log(`[StackManager] DOCKER_HOST: ${env.DOCKER_HOST}`);

            return await new Promise((resolve, reject) => {
                const child = spawn('docker', args, {
                    cwd: stackDir,
                    env: env,
                    shell: true // Use shell for better compatibility
                });

                let stdoutData = '';
                let stderrData = '';

                child.stdout.on('data', (data) => {
                    const line = data.toString().trim();
                    stdoutData += line + '\n';
                    if (line && onLog) onLog(line);
                });

                child.stderr.on('data', (data) => {
                    const line = data.toString().trim();
                    stderrData += line + '\n';
                    if (line && onLog) onLog(line);
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve({ stdout: stdoutData, stderr: stderrData });
                    } else {
                        const errorMsg = `Docker compose exited with code ${code}\n${stderrData}`;
                        reject(new Error(errorMsg));
                    }
                });

                child.on('error', (err) => {
                    reject(err);
                });
            });

        } finally {
            // Cleanup proxy
            if (proxyServer) {
                proxyServer.close();
                if (onLog) onLog('[StackManager] Closed remote agent proxy');
            }
        }
    }

    /**
     * Create a local HTTP proxy to forward requests to the remote Agent.
     * This is required because Docker CLI needs a TCP socket/HTTP endpoint,
     * but the Agent requires custom authentication headers.
     */
    createAgentProxy(endpoint) {
        return new Promise((resolve, reject) => {
            const server = http.createServer((clientReq, clientRes) => {
                const options = {
                    hostname: endpoint.host,
                    port: endpoint.port || 9002,
                    path: clientReq.url,
                    method: clientReq.method,
                    headers: {
                        ...clientReq.headers,
                        'Host': `${endpoint.host}:${endpoint.port || 9002}`,
                        'X-Agent-Secret': endpoint.secret || ''
                    }
                };

                console.log(`[AgentProxy] Proxying request to ${options.hostname}:${options.port} ${options.method} ${options.path}`);

                const proxyReq = http.request(options, (proxyRes) => {
                    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(clientRes, { end: true });
                });

                proxyReq.on('error', (err) => {
                    console.error('Proxy error:', err);
                    clientRes.end();
                });

                clientReq.pipe(proxyReq, { end: true });
            });

            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                resolve({ server, port });
            });

            server.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Deploy a stack (Up).
     */
    async deployStack(stack, endpoint, onLog) {
        const stackDir = path.join(this.stacksDir, stack.id);
        if (!fs.existsSync(stackDir)) {
            throw new Error(`Stack directory not found: ${stack.id}`);
        }

        await this.executeCompose('up -d', stackDir, endpoint, stack.name, onLog, stack.env);
    }

    /**
     * Stop a stack.
     */
    async stopStack(stack, endpoint, onLog) {
        const stackDir = path.join(this.stacksDir, stack.id);
        await this.executeCompose('stop', stackDir, endpoint, stack.name, onLog);
    }

    /**
     * Start a stack.
     */
    async startStack(stack, endpoint, onLog) {
        const stackDir = path.join(this.stacksDir, stack.id);
        await this.executeCompose('start', stackDir, endpoint, stack.name, onLog);
    }

    /**
     * Restart a stack.
     */
    async restartStack(stack, endpoint, onLog) {
        const stackDir = path.join(this.stacksDir, stack.id);
        await this.executeCompose('restart', stackDir, endpoint, stack.name, onLog);
    }

    /**
     * Remove a stack (Down).
     */
    async removeStack(stack, endpoint, removeVolumes, onLog) {
        const stackDir = path.join(this.stacksDir, stack.id);
        const cmd = removeVolumes ? 'down -v' : 'down';
        await this.executeCompose(cmd, stackDir, endpoint, stack.name, onLog);
    }
}

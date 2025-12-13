import { useState, useEffect, useRef } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import axios from 'axios';
import 'xterm/css/xterm.css';

export default function ContainerTerminal({ container, isDark, onClose }) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const terminalRef = useRef(null);
    const term = useRef(null);
    const fitAddon = useRef(null);
    const ws = useRef(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm.js - 始终使用暗色主题（黑底白字）
        term.current = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
            theme: {
                background: '#1a1b26',
                foreground: '#c0caf5',
                cursor: '#c0caf5',
                black: '#15161e',
                red: '#f7768e',
                green: '#9ece6a',
                yellow: '#e0af68',
                blue: '#7aa2f7',
                magenta: '#bb9af7',
                cyan: '#7dcfff',
                white: '#a9b1d6',
                brightBlack: '#414868',
                brightRed: '#f7768e',
                brightGreen: '#9ece6a',
                brightYellow: '#e0af68',
                brightBlue: '#7aa2f7',
                brightMagenta: '#bb9af7',
                brightCyan: '#7dcfff',
                brightWhite: '#c0caf5',
            },
            rows: 30,
            cols: 100
        });

        fitAddon.current = new FitAddon();
        term.current.loadAddon(fitAddon.current);
        term.current.open(terminalRef.current);
        fitAddon.current.fit();

        // Connect WebSocket
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        const currentEndpoint = axios.defaults.headers.common['X-Endpoint-ID'] || localStorage.getItem('dma_current_endpoint') || 'local';
        ws.current = new WebSocket(`${wsProtocol}//${wsHost}/ws/container/${container.Id}/terminal?endpointId=${currentEndpoint}`);

        ws.current.onopen = () => {
            // term.current.writeln('\x1b[1;32mConnected to container terminal\x1b[0m');
            // term.current.writeln('');
        };

        ws.current.onmessage = (event) => {
            term.current.write(event.data);
        };

        ws.current.onerror = (error) => {
            // Suppress default event object logging
            console.error('WebSocket error:', error);
            // term.current.writeln('\x1b[1;31mWebSocket error occurred. Please refresh.\x1b[0m');
        };

        ws.current.onclose = () => {
            // Only show if not manually closed
            if (ws.current) {
                // term.current.writeln('');
                // term.current.writeln('\x1b[1;33mConnection closed\x1b[0m');
            }
        };

        // Send terminal input to WebSocket
        term.current.onData((data) => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ type: 'input', data }));
            }
        });

        // Handle window resize
        const handleResize = () => {
            if (fitAddon.current) {
                fitAddon.current.fit();
                const { rows, cols } = term.current;
                if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                    ws.current.send(JSON.stringify({ type: 'resize', rows, cols }));
                }
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            if (ws.current) {
                ws.current.close();
            }
            if (term.current) {
                term.current.dispose();
            }
            window.removeEventListener('resize', handleResize);
        };
    }, [container.Id]);

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        setTimeout(() => {
            if (fitAddon.current) {
                fitAddon.current.fit();
            }
        }, 100);
    };

    const containerName = container.Names[0]?.replace(/^\//, '') || container.Id.substring(0, 12);

    return (
        <div className={`fixed inset-0 ${isFullscreen ? 'z-[100]' : 'z-50'} flex items-center justify-center bg-black/60 backdrop-blur-sm p-4`}>
            <div className={`${isFullscreen ? 'w-full h-full' : 'w-[90vw] h-[80vh] max-w-7xl'} ${isDark ? 'glass border border-white/20' : 'bg-white border border-gray-300'} rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300`}>
                {/* Header */}
                <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {containerName} - Terminal
                        </h3>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={toggleFullscreen}
                            className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onClose}
                            className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Terminal - 黑色背景 */}
                <div className="flex-1 p-4 overflow-hidden bg-[#1a1b26]">
                    <div ref={terminalRef} className="w-full h-full" />
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect, useRef } from 'react';
import { X, Copy, RefreshCw, Download } from 'lucide-react';
import axios from 'axios';

export default function ContainerLogs({ container, isDark, onClose }) {
    const [logs, setLogs] = useState('');
    const [loading, setLoading] = useState(true);
    const [autoScroll, setAutoScroll] = useState(true);
    const logsEndRef = useRef(null);
    const logsContainerRef = useRef(null);

    const containerName = container.Names[0]?.replace(/^\//, '') || container.Id.substring(0, 12);

    useEffect(() => {
        fetchLogs();
    }, [container.Id]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/containers/${container.Id}/logs?tail=500&timestamps=true`);
            setLogs(response.data);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
            setLogs(`错误: 无法获取日志\n${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(logs);
        alert('日志已复制到剪贴板');
    };

    const handleDownload = () => {
        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${containerName}-logs.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleScroll = () => {
        if (!logsContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(isAtBottom);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-5xl h-[80vh] flex flex-col border shadow-2xl`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            容器日志
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {containerName}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchLogs}
                            className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                            title="刷新"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleCopy}
                            className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                            title="复制"
                        >
                            <Copy className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleDownload}
                            className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                            title="下载"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Logs Content */}
                <div
                    ref={logsContainerRef}
                    onScroll={handleScroll}
                    className={`flex-1 overflow-auto p-4 font-mono text-sm ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}
                >
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                        </div>
                    ) : (
                        <pre className={`whitespace-pre-wrap break-words ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                            {logs || '暂无日志'}
                            <div ref={logsEndRef} />
                        </pre>
                    )}
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-between p-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            自动滚动到底部
                        </span>
                    </label>

                    <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        显示最近 500 行
                    </span>
                </div>
            </div>
        </div>
    );
}

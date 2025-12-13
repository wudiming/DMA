import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, Terminal, Download } from 'lucide-react';
import axios from 'axios';

export default function DeployStackModal({ stackName, isDark, isNewStack, pull, onClose, onDeploySuccess }) {
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState('deploying'); // deploying, success, error
    const [autoScroll, setAutoScroll] = useState(true);
    const [pullState, setPullState] = useState({}); // { [layerId]: { status, progress, current, total } }
    const logsEndRef = useRef(null);
    const logsContainerRef = useRef(null);
    const isDeployingRef = useRef(false);

    useEffect(() => {
        // Prevent double execution in Strict Mode
        if (isDeployingRef.current) return;
        isDeployingRef.current = true;

        startDeployment();
    }, [stackName]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, pullState, autoScroll]);

    const startDeployment = async () => {
        try {
            setLogs([{ type: 'info', message: '开始部署堆栈...' }]);

            const response = await fetch(`/api/stacks/${stackName}/deploy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Endpoint-ID': axios.defaults.headers.common['X-Endpoint-ID'] || 'local'
                },
                body: JSON.stringify({ isNew: isNewStack, pull })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        handleEvent(event);
                    } catch (e) {
                        console.warn('Failed to parse log line:', line);
                    }
                }
            }

        } catch (error) {
            console.error('Failed to deploy stack:', error);
            setLogs(prev => [...prev, { type: 'error', message: `部署请求失败: ${error.message}` }]);
            setStatus('error');
        }
    };

    const handleEvent = (event) => {
        switch (event.type) {
            case 'step':
                setLogs(prev => [...prev, { type: 'step', message: event.message }]);
                break;
            case 'pull-start':
                // 添加 pull-start 消息和 pull-widget
                setLogs(prev => [...prev, { type: 'info', message: event.message }, { type: 'pull-widget' }]);
                break;
            case 'pull':
                handlePullProgress(event.data);
                break;
            case 'command':
                setLogs(prev => [...prev, { type: 'command', message: event.message }]);
                break;
            case 'info':
                setLogs(prev => [...prev, { type: 'info', message: event.message }]);
                break;
            case 'stdout':
                setLogs(prev => [...prev, { type: 'stdout', message: event.message }]);
                break;
            case 'stderr':
                setLogs(prev => [...prev, { type: 'stderr', message: event.message }]);
                break;
            case 'success':
                setLogs(prev => [...prev, { type: 'success', message: event.message }]);
                break;
            case 'done':
                setLogs(prev => [...prev, { type: 'done', message: event.message }]);
                setStatus('success');
                // 调用成功回调,刷新堆栈列表
                if (onDeploySuccess) {
                    onDeploySuccess();
                }
                break;
            case 'error':
                setLogs(prev => [...prev, { type: 'error', message: event.message }]);
                setStatus('error');
                break;
            case 'warning':
                setLogs(prev => [...prev, { type: 'warning', message: event.message }]);
                break;
            default:
                break;
        }
    };

    const handlePullProgress = (data) => {
        if (data.status === 'Downloading' || data.status === 'Extracting') {
            setPullState(prev => ({
                ...prev,
                [data.id]: {
                    status: data.status,
                    progress: data.progressDetail,
                    current: data.progressDetail?.current,
                    total: data.progressDetail?.total
                }
            }));
        } else if (data.status === 'Pull complete' || data.status === 'Already exists') {
            setPullState(prev => ({
                ...prev,
                [data.id]: {
                    ...prev[data.id],
                    status: data.status,
                    current: prev[data.id]?.total || 100,
                    total: prev[data.id]?.total || 100,
                    completed: true
                }
            }));
        }
    };

    const handleScroll = () => {
        if (!logsContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(isAtBottom);
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'deploying':
                return <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-500 border-t-transparent"></div>;
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'deploying': return '部署中...';
            case 'success': return '部署成功';
            case 'error': return '部署失败';
            default: return '';
        }
    };

    // 渲染日志行
    const renderLogLine = (log, index) => {
        switch (log.type) {
            case 'step':
                return (
                    <div key={index} className={`flex items-center gap-2 font-bold mt-4 mb-2 border-b pb-1 ${isDark ? 'text-cyan-400 border-cyan-500/20' : 'text-cyan-600 border-cyan-600/20'}`}>
                        <Terminal className="w-4 h-4" />
                        <span>{log.message}</span>
                    </div>
                );
            case 'command':
                // Parse command to split by flags, grouping flag and value
                const tokens = log.message.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
                const lines = [];
                let currentLine = [];

                tokens.forEach((token, i) => {
                    if (i === 0 && token === 'docker') {
                        currentLine.push(token);
                        return;
                    }
                    if (i === 1 && token === 'run') {
                        currentLine.push(token);
                        lines.push(currentLine);
                        currentLine = [];
                        return;
                    }

                    if (token.startsWith('-')) {
                        if (currentLine.length > 0) {
                            lines.push(currentLine);
                        }
                        currentLine = [token];
                    } else {
                        // Check if it looks like an image (contains / or : and is not a flag value)
                        // Simple heuristic: if it's the last token and doesn't start with -, put it on new line
                        if (i === tokens.length - 1 && !token.startsWith('-') && lines.length > 0) {
                            if (currentLine.length > 0) lines.push(currentLine);
                            currentLine = [token];
                        } else {
                            currentLine.push(token);
                        }
                    }
                });
                if (currentLine.length > 0) lines.push(currentLine);

                return (
                    <div key={index} className={`pl-4 mb-4 font-mono text-sm break-all p-3 rounded-lg border ${isDark ? 'bg-black/30 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                        <div className={`space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {lines.map((lineTokens, i) => (
                                <div key={i} className={`${i > 0 ? 'pl-4' : ''}`}>
                                    {lineTokens.map((token, j) => (
                                        <span key={j} className={`mr-2 ${i === 0 ? (isDark ? 'text-cyan-400 font-bold' : 'text-cyan-600 font-bold') : (token.startsWith('-') ? (isDark ? 'text-yellow-500' : 'text-yellow-600') : (isDark ? 'text-gray-300' : 'text-gray-700'))}`}>
                                            {token}
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'pull-widget':
                return (
                    <div key={index} className="pl-4 mb-4">
                        {Object.keys(pullState).length > 0 && (
                            <div className={`space-y-2 p-4 rounded-lg border ${isDark ? 'bg-black/30 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                                {Object.entries(pullState).map(([id, state]) => (
                                    <div key={id} className="text-xs">
                                        <div className="flex justify-between mb-1">
                                            <span className={state.completed ? (isDark ? 'text-cyan-400' : 'text-cyan-600') : (isDark ? 'text-gray-400' : 'text-gray-500')}>
                                                Layer {id}: {state.status}
                                            </span>
                                            {(state.total || state.completed) && (
                                                <span className={state.completed ? (isDark ? 'text-cyan-400' : 'text-cyan-600') : (isDark ? 'text-gray-500' : 'text-gray-400')}>
                                                    {state.completed ? '100%' : `${Math.round((state.current / state.total) * 100)}%`}
                                                </span>
                                            )}
                                        </div>
                                        {(state.total || state.completed) && (
                                            <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                <div
                                                    className={`${state.completed ? 'bg-cyan-500' : 'bg-blue-500'} h-1.5 rounded-full transition-all duration-300`}
                                                    style={{ width: state.completed ? '100%' : `${(state.current / state.total) * 100}%` }}
                                                ></div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'info':
                return <div key={index} className={`pl-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{log.message}</div>;
            case 'stdout':
                return <div key={index} className={`pl-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{log.message}</div>;
            case 'stderr':
                return <div key={index} className="pl-4 text-yellow-500">{log.message}</div>;
            case 'error':
                return <div key={index} className="pl-4 text-red-500 font-bold bg-red-500/10 p-2 rounded my-2">{log.message}</div>;
            case 'success':
                return <div key={index} className={`pl-4 font-bold p-2 my-2 flex items-center gap-2 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}><CheckCircle className="w-4 h-4" />{log.message}</div>;
            case 'done':
                return <div key={index} className={`pl-4 font-bold mt-4 border-t pt-2 flex items-center gap-2 ${isDark ? 'text-cyan-400 border-white/10' : 'text-cyan-600 border-gray-200'}`}><CheckCircle className="w-4 h-4" />{log.message}</div>;
            case 'warning':
                return <div key={index} className="pl-4 text-orange-500">{log.message}</div>;
            default:
                return <div key={index} className="pl-4 text-gray-500">{log.message}</div>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-4xl h-[80vh] flex flex-col border shadow-2xl`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            堆栈部署
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {stackName}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
                            {getStatusIcon()}
                            <span className={`text-sm font-medium ${status === 'success'
                                ? 'text-green-500'
                                : status === 'error'
                                    ? 'text-red-500'
                                    : isDark ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                {getStatusText()}
                            </span>
                        </div>
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
                    className={`flex-1 overflow-auto p-6 font-mono text-sm ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}
                >
                    <div className="space-y-1">
                        {logs.map((log, index) => renderLogLine(log, index))}

                        <div ref={logsEndRef} />
                    </div>
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-between p-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            自动滚动到底部
                        </span>
                    </label>

                    {status !== 'deploying' && (
                        <button
                            onClick={onClose}
                            className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all text-sm font-medium shadow-lg shadow-cyan-500/20"
                        >
                            关闭
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

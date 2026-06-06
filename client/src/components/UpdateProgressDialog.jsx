import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, AlertTriangle, Loader2, Terminal, ChevronRight } from 'lucide-react';
import axios from 'axios';

export default function UpdateProgressDialog({ isDark, containers, onClose, onSuccess }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [logs, setLogs] = useState({}); // { containerId: [logEntries] }
    const [statuses, setStatuses] = useState({}); // { containerId: 'pending' | 'updating' | 'success' | 'error' }
    const [isFinished, setIsFinished] = useState(false);
    const [pullState, setPullState] = useState({}); // { containerId: { layers: {}, generalLogs: [] } }
    const logsContainerRef = useRef(null);

    const currentContainer = containers && containers.length > 0 ? containers[currentIndex] : null;

    // Helper functions defined before usage to avoid TDZ issues
    const addLog = (containerName, log) => {
        setLogs(prev => ({
            ...prev,
            [containerName]: [...(prev[containerName] || []), log]
        }));
    };

    const handlePullProgress = (containerName, progress) => {
        setPullState(prev => {
            const containerState = prev[containerName] || { layers: {}, generalLogs: [] };
            const newState = { ...containerState };

            if (progress.id) {
                const currentLayer = newState.layers[progress.id] || { size: 0, current: 0, total: 0 };
                let newTotal = currentLayer.total;
                let newCurrent = currentLayer.current;

                if (progress.progressDetail) {
                    if (progress.progressDetail.total) newTotal = progress.progressDetail.total;
                    if (progress.progressDetail.current) newCurrent = progress.progressDetail.current;
                }

                newState.layers[progress.id] = {
                    ...currentLayer,
                    status: progress.status,
                    progress: progress.progress,
                    current: newCurrent,
                    total: newTotal
                };
            } else if (progress.status) {
                newState.generalLogs = [...newState.generalLogs, progress.status];
            }

            return { ...prev, [containerName]: newState };
        });
    };

    const updateContainer = async (containerData) => {
        const currentEndpoint = axios.defaults.headers.common['X-Endpoint-ID'] || localStorage.getItem('dma_current_endpoint');
        const headers = {
            'Content-Type': 'application/json',
        };
        if (currentEndpoint) {
            headers['X-Endpoint-ID'] = currentEndpoint;
        }

        // Add alwaysPull: true to force pull
        const body = { ...containerData, alwaysPull: true };

        let isSelfUpdate = false;

        try {
            const response = await fetch('/api/containers/create', {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);

                        // Check for self-update message
                        if (event.message && (event.message.includes('更新进程已启动') || event.message.includes('更新中'))) {
                            isSelfUpdate = true;
                        }

                        // Handle pull progress separately
                        if (event.type === 'pull') {
                            handlePullProgress(containerData.name, event.data);
                        } else {
                            addLog(containerData.name, event);
                        }

                        if (event.type === 'error') {
                            throw new Error(event.message);
                        }
                    } catch (e) {
                        if (e.message !== "Unexpected end of JSON input") {
                            // If it's a parsing error, log it but don't stop
                            console.error('Error parsing log:', e);
                        } else {
                            // If it's an error thrown above, rethrow it
                            throw e;
                        }
                    }
                }
            }
        } catch (error) {
            if (isSelfUpdate) {
                // Suppress error for self-update
                setStatuses(prev => ({ ...prev, [containerData.name]: 'success' }));
                addLog(containerData.name, { type: 'success', message: '服务正在重启，连接已断开。更新成功！' });
            } else {
                console.error(`Failed to update ${containerData.name}:`, error);
                setStatuses(prev => ({ ...prev, [containerData.name]: 'error' }));
                // Add error log
                addLog(containerData.name, { type: 'error', message: error.message });
            }
        }
    };

    const processQueue = async () => {
        if (!containers || containers.length === 0) return;

        for (let i = 0; i < containers.length; i++) {
            setCurrentIndex(i);
            const container = containers[i];
            setStatuses(prev => ({ ...prev, [container.name]: 'updating' }));

            try {
                await updateContainer(container);
                setStatuses(prev => ({ ...prev, [container.name]: 'success' }));
            } catch (error) {
                console.error(`Failed to update ${container.name}:`, error);
                setStatuses(prev => ({ ...prev, [container.name]: 'error' }));
                // Add error log
                addLog(container.name, { type: 'error', message: error.message });
            }
        }
        setIsFinished(true);
        if (onSuccess) onSuccess();
    };

    useEffect(() => {
        if (containers && containers.length > 0) {
            processQueue();
        }
    }, []);

    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs, currentIndex, pullState]);

    // Helper to calculate percentage
    const getPercentage = (current, total) => {
        if (!total || total === 0) return 0;
        return Math.min(100, Math.max(0, (current / total) * 100));
    };

    const renderLogs = (containerName) => {
        const containerLogs = logs[containerName] || [];
        const containerPullState = pullState[containerName];

        return (
            <div className="space-y-1 font-mono text-sm">
                {containerLogs.map((log, index) => {
                    switch (log.type) {
                        case 'step':
                            return (
                                <div key={index} className={`flex items-center gap-2 py-2 font-bold border-b ${isDark ? 'text-cyan-400 border-white/10' : 'text-cyan-600 border-gray-200'}`}>
                                    <ChevronRight className="w-4 h-4" />
                                    {log.message}
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
                        case 'pull-start':
                            return (
                                <div key={index} className="pl-4 mb-4">
                                    <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{log.message}</div>
                                    {containerPullState && Object.keys(containerPullState.layers).length > 0 && (
                                        <div className={`space-y-2 p-4 rounded-lg border ${isDark ? 'bg-black/30 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                                            {Object.entries(containerPullState.layers).map(([id, layer]) => {
                                                const percent = getPercentage(layer.current, layer.total);
                                                const isDownloading = layer.status === 'Downloading' || layer.status === 'Extracting';
                                                const isCompleted = layer.status === 'Pull complete' || layer.status === 'Already exists';
                                                const showProgress = isDownloading || isCompleted;

                                                return (
                                                    <div key={id} className="text-xs">
                                                        <div className="flex justify-between mb-1">
                                                            <span className={isCompleted ? (isDark ? 'text-cyan-400' : 'text-cyan-600') : (isDark ? 'text-gray-400' : 'text-gray-500')}>
                                                                Layer {id}: {layer.status}
                                                            </span>
                                                            {showProgress && (
                                                                <span className={isCompleted ? (isDark ? 'text-cyan-400' : 'text-cyan-600') : (isDark ? 'text-gray-500' : 'text-gray-400')}>
                                                                    {isCompleted ? '100%' : (layer.total ? `${Math.round((layer.current / layer.total) * 100)}%` : '')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {showProgress && (
                                                            <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                                <div
                                                                    className={`${isCompleted ? 'bg-cyan-500' : 'bg-blue-500'} h-1.5 rounded-full transition-all duration-300`}
                                                                    style={{ width: isCompleted ? '100%' : `${percent}%` }}
                                                                ></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        case 'info':
                            return <div key={index} className={`pl-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{log.message}</div>;
                        case 'success':
                            return (
                                <div key={index} className={`flex items-center gap-2 pl-4 text-green-500`}>
                                    <CheckCircle2 className="w-4 h-4" />
                                    {log.message}
                                </div>
                            );
                        case 'error':
                            return (
                                <div key={index} className={`flex items-center gap-2 pl-4 text-red-500`}>
                                    <AlertTriangle className="w-4 h-4" />
                                    {log.message}
                                </div>
                            );
                        default:
                            return null;
                    }
                })}
            </div>
        );
    };

    if (!currentContainer) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-4xl border shadow-2xl flex flex-col max-h-[85vh]`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-white/10' : 'border-gray-200'} flex-shrink-0`}>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {containers.length > 1 ? `批量更新容器 (${currentIndex + 1}/${containers.length})` : `更新容器: ${containers[0].name}`}
                    </h2>
                    {isFinished && (
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar for batch update */}
                    {containers.length > 1 && (
                        <div className={`w-64 border-r ${isDark ? 'border-white/10' : 'border-gray-200'} overflow-y-auto p-4`}>
                            <div className="space-y-2">
                                {containers.map((c, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${idx === currentIndex
                                            ? (isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-50 text-cyan-600')
                                            : (isDark ? 'text-gray-400' : 'text-gray-600')
                                            }`}
                                    >
                                        {statuses[c.name] === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                        {statuses[c.name] === 'error' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                        {statuses[c.name] === 'updating' && <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />}
                                        {!statuses[c.name] && <div className={`w-4 h-4 rounded-full border-2 ${isDark ? 'border-gray-700' : 'border-gray-300'}`} />}

                                        <span className="text-sm font-medium truncate">{c.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Logs Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className={`p-4 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {currentContainer.name} - 执行日志
                            </h3>
                        </div>
                        <div
                            ref={logsContainerRef}
                            className={`flex-1 overflow-auto p-6 font-mono text-sm ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}
                        >
                            {renderLogs(currentContainer.name)}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-6 border-t ${isDark ? 'border-white/10' : 'border-gray-200'} flex justify-between items-center flex-shrink-0`}>
                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {isFinished ? '所有操作已完成' : '正在处理中，请勿关闭窗口...'}
                    </div>
                    {isFinished && (
                        <button
                            onClick={onClose}
                            className="px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all"
                        >
                            完成
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

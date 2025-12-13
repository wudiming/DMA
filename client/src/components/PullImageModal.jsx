import { useState } from 'react';
import { X, Plus, Download } from 'lucide-react';
import axios from 'axios';

export default function PullImageModal({ isDark, onClose, onSuccess }) {
    const [imageName, setImageName] = useState('');
    const [loading, setLoading] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [pullState, setPullState] = useState({
        layers: {},
        generalLogs: [],
        totalSize: 0
    });

    const handlePull = async (e) => {
        e.preventDefault();
        if (!imageName.trim()) return;

        setLoading(true);
        setIsFinished(false);
        setPullState({ layers: {}, generalLogs: [], totalSize: 0 });

        try {
            const currentEndpoint = axios.defaults.headers.common['X-Endpoint-ID'] || localStorage.getItem('dma_current_endpoint');
            const headers = {
                'Content-Type': 'application/json',
            };

            if (currentEndpoint) {
                headers['X-Endpoint-ID'] = currentEndpoint;
            }

            const response = await fetch('/api/images/pull', {
                method: 'POST',
                headers,
                body: JSON.stringify({ imageName: imageName.trim() }),
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
                        if (event.error) {
                            throw new Error(event.error);
                        }

                        setPullState(prev => {
                            const newState = { ...prev };

                            if (event.id) {
                                // Update layer status
                                const currentLayer = newState.layers[event.id] || { size: 0, current: 0, total: 0 };

                                // Update size info if available
                                let newTotal = currentLayer.total;
                                let newCurrent = currentLayer.current;

                                if (event.progressDetail) {
                                    if (event.progressDetail.total) newTotal = event.progressDetail.total;
                                    if (event.progressDetail.current) newCurrent = event.progressDetail.current;
                                }

                                newState.layers[event.id] = {
                                    ...currentLayer,
                                    status: event.status,
                                    progress: event.progress,
                                    size: newTotal || currentLayer.size, // Use total as size
                                    current: newCurrent,
                                    total: newTotal
                                };
                            } else if (event.status) {
                                // General logs (like "Pulling from...")
                                newState.generalLogs = [...prev.generalLogs, event.status];
                            }

                            // Calculate total size
                            newState.totalSize = Object.values(newState.layers).reduce((acc, layer) => acc + (layer.size || 0), 0);

                            return newState;
                        });

                    } catch (e) {
                        console.error('Error parsing log:', e);
                    }
                }
            }

            setIsFinished(true);
            // onSuccess(); // Don't close automatically
        } catch (error) {
            console.error('Failed to pull image:', error);
            alert(`拉取失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    // Helper to format bytes to MB
    const formatSize = (bytes) => {
        if (!bytes) return '0';
        return (bytes / (1024 * 1024)).toFixed(0);
    };

    // Helper to calculate percentage
    const getPercentage = (current, total) => {
        if (!total || total === 0) return 0;
        return Math.min(100, Math.max(0, (current / total) * 100));
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-4xl border shadow-2xl flex flex-col max-h-[80vh]`}>
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-white/10' : 'border-gray-200'} flex-shrink-0`}>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        拉取镜像: {imageName || '...'}
                    </h2>
                    {!loading && (
                        <button
                            onClick={handleClose}
                            className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-6 flex-1 overflow-hidden flex flex-col">
                    {!loading && !isFinished ? (
                        <form onSubmit={handlePull} className="flex-shrink-0">
                            <div className="mb-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    镜像名称
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={imageName}
                                        onChange={(e) => setImageName(e.target.value)}
                                        placeholder="例如: nginx:latest"
                                        className={`flex-1 px-4 py-3 rounded-lg ${isDark ? 'glass text-white placeholder-gray-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                        disabled={loading}
                                    />
                                    <button
                                        type="submit"
                                        className="px-6 py-3 rounded-lg font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        disabled={loading || !imageName.trim()}
                                    >
                                        拉取
                                    </button>
                                </div>
                                <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    支持 Docker Hub 官方镜像，格式：镜像名:标签
                                </p>
                            </div>
                        </form>
                    ) : (
                        <div className={`flex-1 overflow-y-auto p-6 font-mono text-sm ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
                            {/* General Logs */}
                            {pullState.generalLogs.map((log, index) => (
                                <div key={`gen-${index}`} className={`pl-4 mb-1 whitespace-pre-wrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {log}
                                </div>
                            ))}
                            {/* Layer Logs */}
                            {Object.keys(pullState.layers).length > 0 && (
                                <div className="pl-4 mb-4">
                                    <div className={`space-y-2 p-4 rounded-lg border ${isDark ? 'bg-black/30 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                                        {Object.entries(pullState.layers).map(([id, layer]) => {
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
                                </div>
                            )}


                            {(loading || isFinished) && (
                                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'} flex justify-between items-center`}>
                                    <div className={`font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        拉取的数据总量: {formatSize(pullState.totalSize)} MB
                                    </div>
                                    {loading ? (
                                        <div className="animate-pulse text-cyan-500">
                                            正在拉取中...
                                        </div>
                                    ) : (
                                        <button
                                            onClick={onSuccess}
                                            className="px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all"
                                        >
                                            完成
                                        </button>
                                    )}
                                </div>

                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

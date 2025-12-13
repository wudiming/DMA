import { useState } from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function UpdateContainerModal({ container, isDark, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const containerName = container.Names[0]?.replace(/^\//, '') || container.Id.substring(0, 12);
    const imageName = container.Image;

    const handleUpdate = async () => {
        setLoading(true);
        setStatus('正在拉取最新镜像...');

        try {
            await axios.post(`/api/containers/${container.Id}/update`);
            setStatus('✓ 更新成功！');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Failed to update container:', error);
            setStatus(`✗ 更新失败: ${error.response?.data?.error || error.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-md border shadow-2xl`}>
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        更新容器
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                            容器名称:
                        </p>
                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {containerName}
                        </p>
                    </div>

                    <div className="mb-6">
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                            镜像:
                        </p>
                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {imageName}
                        </p>
                    </div>

                    {status && (
                        <div className={`mb-4 p-3 rounded-lg ${status.startsWith('✓') ? 'bg-green-500/20 text-green-400' :
                                status.startsWith('✗') ? 'bg-red-500/20 text-red-400' :
                                    'bg-blue-500/20 text-blue-400'
                            }`}>
                            {status}
                        </div>
                    )}

                    <div className={`mb-4 p-4 rounded-lg ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-800'}`}>
                            ⚠️ 更新过程将：
                        </p>
                        <ul className={`text-xs mt-2 ml-4 list-disc ${isDark ? 'text-yellow-500' : 'text-yellow-700'}`}>
                            <li>拉取最新镜像</li>
                            <li>停止并删除当前容器</li>
                            <li>使用相同配置重建容器</li>
                            <li>启动新容器</li>
                        </ul>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${isDark ? 'glass glass-hover text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                } disabled:opacity-50`}
                        >
                            取消
                        </button>
                        <button
                            onClick={handleUpdate}
                            disabled={loading}
                            className="flex-1 px-4 py-3 rounded-lg font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>更新中...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-5 h-5" />
                                    <span>立即更新</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

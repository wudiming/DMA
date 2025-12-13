import { useState, useEffect } from 'react';
import { X, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import yaml from 'js-yaml';
import ComposeEditor from './ComposeEditor';
import { validateCompose } from '../utils/validators';

export default function AddComposeModal({
    isDark,
    stackName,
    initialContent = '',
    onSave,
    onClose
}) {
    const [composeContent, setComposeContent] = useState(initialContent);
    const [description, setDescription] = useState('');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    // YAML验证
    useEffect(() => {
        setError(validateCompose(composeContent));
    }, [composeContent]);

    const handleSave = async () => {
        if (error || !composeContent.trim()) {
            return;
        }

        setSaving(true);
        try {
            // 自动修复 labels 格式 (从数组转换为对象)
            // Docker Compose 有时对 labels 格式要求严格，必须是 mapping
            const doc = yaml.load(composeContent);
            let hasChanges = false;

            if (doc && doc.services) {
                Object.keys(doc.services).forEach(serviceName => {
                    const service = doc.services[serviceName];
                    if (service.labels && Array.isArray(service.labels)) {
                        console.log(`Fixing labels for service ${serviceName}`);
                        const labelsObj = {};
                        service.labels.forEach(label => {
                            if (typeof label === 'string') {
                                const parts = label.split('=');
                                const key = parts[0];
                                const value = parts.slice(1).join('=');
                                if (key) {
                                    labelsObj[key] = value || '';
                                }
                            }
                        });
                        service.labels = labelsObj;
                        hasChanges = true;
                    }
                });
            }

            const finalContent = hasChanges ? yaml.dump(doc) : composeContent;

            await onSave(finalContent, description);
        } catch (err) {
            console.error('Failed to process compose content:', err);
            // 如果转换失败，仍然尝试保存原始内容
            await onSave(composeContent, description);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border shadow-2xl`}>
                {/* Header */}
                <div className={`p-6 border-b flex-shrink-0 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {initialContent ? '编辑配置文件' : '接管外部堆栈'}
                            </h2>
                            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {initialContent ? '修改' : '为外部堆栈'} <span className={`font-semibold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{stackName}</span> {initialContent ? '的配置' : '添加配置以启用完整管理功能'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-4">
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            描述 (可选)
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="描述这个堆栈的用途..."
                            className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            docker-compose.yml 内容 *
                        </label>
                        <ComposeEditor
                            value={composeContent}
                            onChange={(e) => setComposeContent(e.target.value)}
                            error={error}
                            isDark={isDark}
                            placeholder={`version: '3.8'\nservices: \n  web: \n    image: nginx:latest\n    ports: \n      - "80:80"`}
                            rows={16}
                        />
                    </div>

                    {error && (
                        <div className={`flex items-start gap-2 p-3 rounded-lg ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-800'}`}>配置验证失败</p>
                                <p className={`text-sm mt-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error.message}</p>
                            </div>
                        </div>
                    )}


                </div>

                {/* Footer */}
                <div className={`p-6 border-t flex justify-end gap-3 flex-shrink-0 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 border border-gray-200 text-gray-700'}`}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!!error || !composeContent.trim() || saving}
                        className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all font-medium shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                保存中...
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                {initialContent ? '保存配置' : '接管并保存'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

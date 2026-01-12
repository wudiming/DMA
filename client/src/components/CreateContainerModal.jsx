import { useState, useEffect, useRef } from 'react';
import { X, Terminal, Layout, ArrowRight, Image as ImageIcon, Plus, Trash2, CheckCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { useEndpoint } from '../context/EndpointContext';

export default function CreateContainerModal({ isDark, onClose, onSuccess, initialData }) {
    const { currentEndpoint, endpoints } = useEndpoint();
    const { t } = useTranslation();
    const [mode, setMode] = useState('form'); // 'form' | 'command'
    const [command, setCommand] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        image: '',
        iconUrl: '',
        webUi: '',
        ports: [], // 默认为空，不显示输入框
        volumes: [], // 默认为空，不显示输入框
        env: [], // 默认为空，不显示输入框
        restart: 'always', // 默认总是重启
        network: 'bridge',
        alwaysPull: false,
        entrypoint: '',
        cmd: '',
        capAdd: [],
        devices: [],
        sysctls: []
    });
    const [showIconInput, setShowIconInput] = useState(false);
    const [showWebUiInput, setShowWebUiInput] = useState(false);
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [activeTab, setActiveTab] = useState('general'); // general, network, storage, env, advanced

    const isEdit = !!initialData && !!initialData.containerId;

    // Log Streaming State
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState('deploying'); // deploying, success, error
    const [autoScroll, setAutoScroll] = useState(true);
    const [pullState, setPullState] = useState({});

    const logsEndRef = useRef(null);
    const logsContainerRef = useRef(null);
    const isSubmitting = useRef(false);
    const abortControllerRef = useRef(null);
    const isSelfUpdateRef = useRef(false);

    useEffect(() => {
        if (showLogs && autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, pullState, autoScroll, showLogs]);

    useEffect(() => {
        fetchTemplates();
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                image: initialData.image || '',
                iconUrl: initialData.iconUrl || '',
                webUi: initialData.webUi || '',
                ports: initialData.ports || [],
                volumes: initialData.volumes || [],
                env: initialData.env || [],
                restart: initialData.restart || 'always',
                network: initialData.network || 'bridge',
                alwaysPull: false,
                entrypoint: initialData.entrypoint || '',
                cmd: initialData.cmd || '',
                capAdd: initialData.capAdd || [],
                devices: initialData.devices || [],
                sysctls: initialData.sysctls || []
            });
            if (initialData.iconUrl) setShowIconInput(true);
            if (initialData.webUi) setShowWebUiInput(true);
        }
    }, [initialData]);

    // Auto-fill WebUI when ports change or when adding WebUI
    useEffect(() => {
        if (!formData.webUi && showWebUiInput) {
            const host = currentEndpoint ? (currentEndpoint.ip || 'localhost') : 'localhost';
            // Try to find a port
            let port = '';
            if (formData.ports.length > 0) {
                const firstPort = formData.ports[0];
                if (firstPort && firstPort.includes(':')) {
                    const hostPort = firstPort.split(':')[0];
                    if (!isNaN(hostPort)) {
                        port = hostPort;
                    }
                }
            }
            setFormData(prev => ({ ...prev, webUi: `${host}:${port}` }));
        }
    }, [showWebUiInput, currentEndpoint]); // Trigger when input is shown

    const fetchTemplates = async () => {
        try {
            const res = await axios.get('/api/templates/user');
            setTemplates(res.data);
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        }
    };

    const handleDeleteTemplate = async (templateId, e) => {
        e.preventDefault();
        if (!window.confirm(t('common.confirm_delete') || 'Are you sure you want to delete this template?')) return;

        try {
            await axios.delete(`/api/templates/user/${templateId}`);
            if (selectedTemplate === templateId) {
                setSelectedTemplate('');
            }
            fetchTemplates();
        } catch (err) {
            console.error('Failed to delete template:', err);
            alert('Failed to delete template');
        }
    };

    const handleTemplateSelect = (e) => {
        const templateId = e.target.value;
        setSelectedTemplate(templateId);

        if (!templateId) {
            // 清空表单
            setFormData({
                name: '',
                image: '',
                iconUrl: '',
                webUi: '',
                ports: [],
                volumes: [],
                env: [],
                restart: 'always',
                network: 'bridge'
            });
            setShowIconInput(false);
            setShowWebUiInput(false);
            return;
        }

        const template = templates.find(t => t.id === templateId);
        if (template) {
            setFormData(template.data);
            if (template.data.iconUrl) setShowIconInput(true);
            if (template.data.webUi) setShowWebUiInput(true);
        }
    };

    const parseDockerCommand = () => {
        if (!command.trim()) return;

        try {
            // 简单的 docker run 命令解析逻辑
            // 移除换行符和反斜杠
            const cleanCmd = command.replace(/\\\n/g, ' ').replace(/\n/g, ' ');

            // 更好的参数分割逻辑，处理 key=value 情况
            const args = [];
            const parts = cleanCmd.split(/\s+/);

            for (const part of parts) {
                if (part.includes('=') && part.startsWith('-')) {
                    // 处理 --restart=always 这种情况
                    const [key, value] = part.split('=');
                    args.push(key);
                    if (value) args.push(value);
                } else {
                    args.push(part);
                }
            }

            const newData = {
                name: '',
                image: '',
                iconUrl: '',
                webUi: '',
                ports: [],
                volumes: [],
                env: [],
                restart: 'always',
                network: 'bridge',
                entrypoint: '',
                cmd: '',
                capAdd: [],
                devices: [],
                sysctls: []
            };

            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (arg === '--name') {
                    newData.name = args[++i];
                } else if (arg === '-p' || arg === '--publish') {
                    newData.ports.push(args[++i]);
                } else if (arg === '-v' || arg === '--volume') {
                    newData.volumes.push(args[++i]);
                } else if (arg === '-e' || arg === '--env') {
                    newData.env.push(args[++i]);
                } else if (arg === '--restart') {
                    newData.restart = args[++i];
                } else if (arg === '--net' || arg === '--network') {
                    newData.network = args[++i];
                } else if (arg === '--entrypoint') {
                    newData.entrypoint = args[++i];
                } else if (arg === '--cap-add') {
                    newData.capAdd.push(args[++i]);
                } else if (arg === '--device') {
                    const device = args[++i];
                    const [pathOnHost, pathInContainer, cgroupPermissions] = device.split(':');
                    newData.devices.push({
                        PathOnHost: pathOnHost,
                        PathInContainer: pathInContainer || pathOnHost,
                        CgroupPermissions: cgroupPermissions || 'rwm'
                    });
                } else if (arg === '--sysctl') {
                    const [key, value] = args[++i].split('=');
                    newData.sysctls.push({ key, value });
                } else if (!arg.startsWith('-')) {
                    if (!newData.image) {
                        // First non-flag argument is image
                        newData.image = arg;
                    } else {
                        // Subsequent non-flag arguments are command
                        // If cmd is empty, start it. If not, append.
                        // Note: This is a simplification. Docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
                        // We treat everything after image as command.
                        if (newData.cmd) newData.cmd += ' ' + arg;
                        else newData.cmd = arg;
                    }
                }
            }

            setFormData(newData);
            setMode('form');
        } catch (error) {
            alert(t('container.command_parse_fail'));
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
            case 'error':
                return <div key={index} className="pl-4 text-red-500 font-bold bg-red-500/10 p-2 rounded my-2">{log.message}</div>;
            case 'success':
                return <div key={index} className={`pl-4 font-bold p-2 my-2 flex items-center gap-2 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}><CheckCircle className="w-4 h-4" />{log.message}</div>;
            case 'done':
                return <div key={index} className={`pl-4 font-bold mt-4 border-t pt-2 flex items-center gap-2 ${isDark ? 'text-cyan-400 border-white/10' : 'text-cyan-600 border-gray-200'}`}><CheckCircle className="w-4 h-4" />{log.message}</div>;
            default:
                return <div key={index} className="pl-4 text-gray-500">{log.message}</div>;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting.current) return;

        // Cancel previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        isSubmitting.current = true;

        if (!formData.name || !formData.image) {
            alert(t('container.name_image_required'));
            isSubmitting.current = false;
            return;
        }

        if (isEdit) {
            if (!window.confirm(t('container.rebuild_confirm'))) {
                isSubmitting.current = false;
                return;
            }
        }


        setLoading(true);
        setShowLogs(true);
        setLogs([]);
        setStatus('deploying');
        setPullState({});
        isSelfUpdateRef.current = false;

        try {
            // 如果是编辑模式，先尝试删除旧容器
            // 如果是编辑模式
            // 只有当容器名称改变时，才在前端手动删除旧容器
            // 如果名称没变，交给后端处理（后端有重建逻辑，且能处理DMA自我更新）
            if (isEdit && initialData.name && initialData.name !== formData.name) {
                setLogs(prev => [...prev, { type: 'step', message: t('container.cleaning_up') + ' (' + t('common.name') + ' ' + t('common.changed') + ')' }]);
                try {
                    await axios.post(`/api/containers/${initialData.name}/stop`);
                    setLogs(prev => [...prev, { type: 'info', message: t('container.container_stopped') }]);
                    await axios.delete(`/api/containers/${initialData.name}`);
                    setLogs(prev => [...prev, { type: 'info', message: t('container.container_removed') }]);
                } catch (err) {
                    if (err.response && err.response.status === 404) {
                        setLogs(prev => [...prev, { type: 'info', message: '旧容器不存在，跳过清理' }]);
                    } else {
                        setLogs(prev => [...prev, { type: 'error', message: t('container.cleanup_failed') + `: ${err.message}` }]);
                    }
                }
            }

            const labels = {};
            if (formData.iconUrl && formData.iconUrl.trim()) {
                labels['ICON_URL'] = formData.iconUrl.trim();
            }
            if (formData.webUi && formData.webUi.trim()) {
                labels['WEBUI_URL'] = formData.webUi.trim();
            }

            const payload = {
                name: formData.name,
                image: formData.image,
                ports: formData.ports.filter(p => p.trim()),
                volumes: formData.volumes.filter(v => v.trim()),
                env: formData.env.filter(e => e.trim()),
                restart: formData.restart,
                network: formData.network,
                labels: labels,
                alwaysPull: formData.alwaysPull,
                entrypoint: formData.entrypoint && formData.entrypoint.trim() ? formData.entrypoint.trim().split(' ') : undefined, // Split by space for array
                cmd: formData.cmd && formData.cmd.trim() ? formData.cmd.trim().split(' ') : undefined,
                capAdd: formData.capAdd.filter(c => c.trim()),
                devices: formData.devices.filter(d => d.PathOnHost && d.PathInContainer),
                sysctls: formData.sysctls.reduce((acc, curr) => {
                    if (curr.key && curr.value) acc[curr.key] = curr.value;
                    return acc;
                }, {})
            };

            // 自动保存为模板
            try {
                await axios.post('/api/templates/user', {
                    name: formData.name,
                    data: formData
                });
            } catch (err) {
                console.warn('Failed to auto-save template:', err);
            }

            const response = await fetch('/api/containers/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Endpoint-ID': axios.defaults.headers.common['X-Endpoint-ID'] || 'local'
                },
                body: JSON.stringify(payload),
                signal: abortControllerRef.current.signal
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);

                        // Check for self-update message immediately
                        if (event.message && (event.message.includes('更新进程已启动') || event.message.includes('更新中'))) {
                            isSelfUpdateRef.current = true;
                        }

                        if (event.type === 'pull') {
                            handlePullProgress(event.data);
                        } else if (event.type === 'pull-start') {
                            setLogs(prev => [...prev, { type: 'info', message: event.message }, { type: 'pull-widget' }]);
                        } else if (event.type === 'command') {
                            setLogs(prev => [...prev, { type: 'command', message: event.message }]);
                        } else {
                            setLogs(prev => [...prev, event]);
                            if (event.type === 'error') setStatus('error');
                            if (event.type === 'done') setStatus('success');
                        }
                    } catch (e) {
                        console.warn('Failed to parse log line:', line);
                    }
                }
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                // Ignore abort errors
            } else {
                // Check if it was a self-update
                if (isSelfUpdateRef.current) {
                    setStatus('success');
                    setLogs(prev => [...prev, { type: 'success', message: t('container.service_restarting') }]);
                } else {
                    setStatus('error');
                    setLogs(prev => [...prev, { type: 'error', message: error.message || 'Network Error' }]);
                }
            }
        } finally {
            setLoading(false);
            isSubmitting.current = false;
        }
    };

    const addField = (field) => {
        setFormData(prev => ({
            ...prev,
            [field]: [...prev[field], '']
        }));
    };

    const updateField = (field, index, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].map((item, i) => i === index ? value : item)
        }));
    };

    const removeField = (field, index) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].filter((_, i) => i !== index)
        }));
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'deploying':
                return <Loader2 className="animate-spin w-4 h-4 text-cyan-500" />;
            case 'success':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'deploying': return isEdit ? t('container.rebuilding') : t('container.creating');
            case 'success': return isEdit ? t('container.rebuild_success') : t('container.create_success');
            case 'error': return isEdit ? t('container.rebuild_fail') : t('container.create_fail');
            default: return '';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-4xl border shadow-2xl flex flex-col h-[85vh]`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b flex-shrink-0 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {isEdit ? t('container.rebuild_title') : t('container.create_title')}
                    </h2>

                    <div className="flex items-center gap-3">
                        {showLogs && (
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
                        )}
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {showLogs ? (
                    // 日志视图
                    <div className="flex flex-col flex-1 min-h-0">
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
                        <div className={`p-4 border-t flex items-center justify-between ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={autoScroll}
                                    onChange={(e) => setAutoScroll(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                                />
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('container.auto_scroll')}
                                </span>
                            </label>
                            {status !== 'deploying' && (
                                <button
                                    onClick={() => {
                                        onSuccess();
                                        onClose();
                                    }}
                                    className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all text-sm font-medium shadow-lg shadow-cyan-500/20"
                                >
                                    {t('container.finish')}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    // 表单视图
                    <>
                        {/* Mode Tabs */}
                        <div className={`flex border-b flex-shrink-0 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                            <button
                                onClick={() => setMode('form')}
                                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${mode === 'form'
                                    ? 'border-cyan-500 text-cyan-500'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Layout className="w-4 h-4" />
                                {t('container.form_mode')}
                            </button>
                            <button
                                onClick={() => setMode('command')}
                                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${mode === 'command'
                                    ? 'border-cyan-500 text-cyan-500'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Terminal className="w-4 h-4" />
                                {t('container.command_mode')}
                            </button>
                        </div>

                        {/* Content Area - Scrollable */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {mode === 'command' ? (
                                <div className="p-6 space-y-4">
                                    <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                                        <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('container.command_placeholder')}
                                        </p>
                                        <textarea
                                            value={command}
                                            onChange={(e) => setCommand(e.target.value)}
                                            placeholder="docker run -d --name my-app -p 8080:80 nginx:latest"
                                            className={`w-full h-40 p-4 rounded-lg font-mono text-sm ${isDark ? 'bg-black/30 text-white' : 'bg-white border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                        />
                                    </div>
                                    {/* Buttons moved to footer */}
                                </div>
                            ) : (
                                <form id="create-container-form" onSubmit={handleSubmit} className="h-full flex flex-col">
                                    <div className={`flex border-b ${isDark ? 'border-white/10' : 'border-gray-200'} px-6`}>
                                        {['general', 'network', 'storage', 'env', 'advanced'].map(tab => (
                                            <button
                                                key={tab}
                                                type="button"
                                                onClick={() => setActiveTab(tab)}
                                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                                    ? 'border-cyan-500 text-cyan-500'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                                    }`}
                                            >
                                                {t(`container.tab_${tab}`) || tab.charAt(0).toUpperCase() + tab.slice(1)}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                        {/* General Tab */}
                                        {activeTab === 'general' && (
                                            <div className="space-y-6">
                                                {/* Template Select */}
                                                {!isEdit && (
                                                    <div className={`px-4 py-3 rounded-lg border flex items-center gap-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-blue-50/50 border-blue-100'}`}>
                                                        <label className={`block text-sm font-medium whitespace-nowrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.template_select')}
                                                        </label>
                                                        <select
                                                            value={selectedTemplate}
                                                            onChange={handleTemplateSelect}
                                                            className={`flex-1 px-3 py-1.5 text-sm rounded-md ${isDark ? 'glass text-white' : 'bg-white border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                        >
                                                            <option value="">{t('container.no_template')}</option>
                                                            {templates.map(t => (
                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                            ))}
                                                        </select>
                                                        {selectedTemplate && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDeleteTemplate(selectedTemplate, e)}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                                title={t('common.delete')}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.container_name')} *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.name}
                                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                            placeholder="my-container"
                                                            className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.image_label')} *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.image}
                                                            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                                            placeholder="nginx:latest"
                                                            className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Icon & WebUI */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                {t('container.icon_url')}
                                                            </label>
                                                            {!showIconInput && !formData.iconUrl && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowIconInput(true)}
                                                                    className="text-sm text-cyan-500 hover:text-cyan-400 font-medium px-3 py-1 bg-cyan-500/10 rounded-full transition-colors"
                                                                >
                                                                    + {t('common.add')}
                                                                </button>
                                                            )}
                                                        </div>
                                                        {(showIconInput || formData.iconUrl) && (
                                                            <div className="flex gap-2">
                                                                <div className="relative flex-1">
                                                                    <input
                                                                        type="text"
                                                                        value={formData.iconUrl}
                                                                        onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                                                                        placeholder="https://example.com/icon.png"
                                                                        className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setFormData({ ...formData, iconUrl: '' });
                                                                            setShowIconInput(false);
                                                                        }}
                                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                                {formData.iconUrl && (
                                                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 border border-white/10">
                                                                        <img src={formData.iconUrl} alt="" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                {t('container.webui_url')}
                                                            </label>
                                                            {!showWebUiInput && !formData.webUi && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowWebUiInput(true)}
                                                                    className="text-sm text-cyan-500 hover:text-cyan-400 font-medium px-3 py-1 bg-cyan-500/10 rounded-full transition-colors"
                                                                >
                                                                    + {t('common.add')}
                                                                </button>
                                                            )}
                                                        </div>
                                                        {(showWebUiInput || formData.webUi) && (
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={formData.webUi}
                                                                    onChange={(e) => setFormData({ ...formData, webUi: e.target.value })}
                                                                    placeholder="127.0.0.1:8080"
                                                                    className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, webUi: '' });
                                                                        setShowWebUiInput(false);
                                                                    }}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        {t('container.restart_policy')}
                                                    </label>
                                                    <select
                                                        value={formData.restart}
                                                        onChange={(e) => setFormData({ ...formData, restart: e.target.value })}
                                                        className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                    >
                                                        <option value="no">{t('common.restart_no')}</option>
                                                        <option value="always">{t('common.restart_always')}</option>
                                                        <option value="on-failure">{t('common.restart_on_failure')}</option>
                                                        <option value="unless-stopped">{t('common.restart_unless_stopped')}</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {/* Network Tab */}
                                        {activeTab === 'network' && (
                                            <div className="space-y-6">
                                                <div>
                                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        {t('container.network_mode')}
                                                    </label>
                                                    <select
                                                        value={formData.network}
                                                        onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                                                        className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                    >
                                                        <option value="bridge">{t('common.network_bridge')}</option>
                                                        <option value="host">{t('common.network_host')}</option>
                                                        <option value="none">{t('common.network_none')}</option>
                                                        <option value="custom">{t('common.network_custom')}</option>
                                                    </select>
                                                    {formData.network === 'custom' && (
                                                        <input
                                                            type="text"
                                                            value={formData.network}
                                                            onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                                                            placeholder="custom_network"
                                                            className={`mt-2 w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                        />
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.ports')}
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => addField('ports')}
                                                            className="text-sm text-cyan-500 hover:text-cyan-400 font-medium px-3 py-1 bg-cyan-500/10 rounded-full transition-colors"
                                                        >
                                                            + {t('common.add')}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {formData.ports.map((port, index) => (
                                                            <div key={index} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={port}
                                                                    onChange={(e) => updateField('ports', index, e.target.value)}
                                                                    placeholder="8080:80"
                                                                    className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeField('ports', index)}
                                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {formData.ports.length === 0 && (
                                                            <div className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {t('container.no_ports')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Storage Tab */}
                                        {activeTab === 'storage' && (
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.volumes')}
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => addField('volumes')}
                                                            className="text-sm text-cyan-500 hover:text-cyan-400 font-medium px-3 py-1 bg-cyan-500/10 rounded-full transition-colors"
                                                        >
                                                            + {t('common.add')}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {formData.volumes.map((vol, index) => (
                                                            <div key={index} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={vol}
                                                                    onChange={(e) => updateField('volumes', index, e.target.value)}
                                                                    placeholder="/host/path:/container/path"
                                                                    className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeField('volumes', index)}
                                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {formData.volumes.length === 0 && (
                                                        <div className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                            {t('container.no_volumes')}
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        )}

                                        {/* Environment Tab */}
                                        {activeTab === 'env' && (
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.env_vars')}
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => addField('env')}
                                                            className="text-sm text-cyan-500 hover:text-cyan-400 font-medium px-3 py-1 bg-cyan-500/10 rounded-full transition-colors"
                                                        >
                                                            + {t('common.add')}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {formData.env.map((env, index) => (
                                                            <div key={index} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={env}
                                                                    onChange={(e) => updateField('env', index, e.target.value)}
                                                                    placeholder="KEY=VALUE"
                                                                    className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeField('env', index)}
                                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {formData.env.length === 0 && (
                                                            <div className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {t('container.no_env')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Advanced Tab */}
                                        {activeTab === 'advanced' && (
                                            <div className="space-y-6">
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.entrypoint')}
                                                        </label>
                                                        <textarea
                                                            value={formData.entrypoint}
                                                            onChange={(e) => setFormData({ ...formData, entrypoint: e.target.value })}
                                                            placeholder="/bin/sh -c"
                                                            rows={2}
                                                            className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.command')}
                                                        </label>
                                                        <textarea
                                                            value={formData.cmd}
                                                            onChange={(e) => setFormData({ ...formData, cmd: e.target.value })}
                                                            placeholder="npm start"
                                                            rows={2}
                                                            className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Capabilities */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.capabilities')}
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, capAdd: [...prev.capAdd, ''] }))}
                                                            className="text-sm text-cyan-500 hover:text-cyan-400 font-medium px-3 py-1 bg-cyan-500/10 rounded-full transition-colors"
                                                        >
                                                            + {t('common.add')}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {formData.capAdd.map((cap, index) => (
                                                            <div key={index} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={cap}
                                                                    onChange={(e) => {
                                                                        const newCaps = [...formData.capAdd];
                                                                        newCaps[index] = e.target.value;
                                                                        setFormData({ ...formData, capAdd: newCaps });
                                                                    }}
                                                                    placeholder="NET_ADMIN"
                                                                    className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newCaps = formData.capAdd.filter((_, i) => i !== index);
                                                                        setFormData({ ...formData, capAdd: newCaps });
                                                                    }}
                                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Devices */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.devices')}
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, devices: [...prev.devices, { PathOnHost: '', PathInContainer: '', CgroupPermissions: 'rwm' }] }))}
                                                            className="text-sm text-cyan-500 hover:text-cyan-400 font-medium px-3 py-1 bg-cyan-500/10 rounded-full transition-colors"
                                                        >
                                                            + {t('common.add')}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {formData.devices.map((device, index) => (
                                                            <div key={index} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={device.PathOnHost}
                                                                    onChange={(e) => {
                                                                        const newDevices = [...formData.devices];
                                                                        newDevices[index].PathOnHost = e.target.value;
                                                                        setFormData({ ...formData, devices: newDevices });
                                                                    }}
                                                                    placeholder="Host Path (/dev/net/tun)"
                                                                    className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={device.PathInContainer}
                                                                    onChange={(e) => {
                                                                        const newDevices = [...formData.devices];
                                                                        newDevices[index].PathInContainer = e.target.value;
                                                                        setFormData({ ...formData, devices: newDevices });
                                                                    }}
                                                                    placeholder="Container Path"
                                                                    className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newDevices = formData.devices.filter((_, i) => i !== index);
                                                                        setFormData({ ...formData, devices: newDevices });
                                                                    }}
                                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Sysctls */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {t('container.sysctls')}
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, sysctls: [...prev.sysctls, { key: '', value: '' }] }))}
                                                            className="text-sm text-cyan-500 hover:text-cyan-400 font-medium px-3 py-1 bg-cyan-500/10 rounded-full transition-colors"
                                                        >
                                                            + {t('common.add')}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {formData.sysctls.map((sysctl, index) => (
                                                            <div key={index} className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={sysctl.key}
                                                                    onChange={(e) => {
                                                                        const newSysctls = [...formData.sysctls];
                                                                        newSysctls[index].key = e.target.value;
                                                                        setFormData({ ...formData, sysctls: newSysctls });
                                                                    }}
                                                                    placeholder="net.ipv4.ip_forward"
                                                                    className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={sysctl.value}
                                                                    onChange={(e) => {
                                                                        const newSysctls = [...formData.sysctls];
                                                                        newSysctls[index].value = e.target.value;
                                                                        setFormData({ ...formData, sysctls: newSysctls });
                                                                    }}
                                                                    placeholder="1"
                                                                    className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'glass text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newSysctls = formData.sysctls.filter((_, i) => i !== index);
                                                                        setFormData({ ...formData, sysctls: newSysctls });
                                                                    }}
                                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>



                                </form>
                            )}
                        </div>

                        {/* Footer - Fixed */}
                        <div className={`p-6 border-t flex-shrink-0 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`flex-1 px-4 py-3 rounded-lg font-medium ${isDark ? 'glass glass-hover text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} ${mode === 'command' ? 'hidden' : ''}`}
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    form="create-container-form"
                                    className={`flex-1 px-4 py-3 rounded-lg font-medium text-white disabled:opacity-50 ${isEdit ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600' : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'} ${mode === 'command' ? 'hidden' : ''}`}
                                    disabled={loading}
                                >
                                    {loading ? (isEdit ? t('container.rebuilding') : t('container.creating')) : (isEdit ? t('container.rebuild_title') : t('container.create_title'))}
                                </button>
                                {mode === 'command' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={parseDockerCommand}
                                            className={`flex-1 px-4 py-3 rounded-lg font-medium ${isDark ? 'glass glass-hover text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                                        >
                                            {t('container.parse_command')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                parseDockerCommand();
                                                setTimeout(() => {
                                                    const submitBtn = document.querySelector('button[form="create-container-form"]');
                                                    if (submitBtn) submitBtn.click();
                                                }, 100);
                                            }}
                                            className="flex-1 px-4 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20"
                                        >
                                            {t('container.run_directly')}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

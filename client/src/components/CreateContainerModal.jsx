import { useState, useEffect, useRef } from 'react';
import { X, Terminal, Layout, ArrowRight, Image as ImageIcon, Plus, Trash2, CheckCircle, AlertCircle, Download, Loader2, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import GlassSelect from './GlassSelect';

import { useEndpoint } from '../context/EndpointContext';

export default function CreateContainerModal({ isDark, onClose, onSuccess, initialData }) {
    const { currentEndpoint, endpoints } = useEndpoint();
    const { t } = useTranslation();
    const [mode, setMode] = useState('form'); // 'form' | 'command'
    const [command, setCommand] = useState('');
    const [composeContent, setComposeContent] = useState('');
    const [composeError, setComposeError] = useState('');
    const [commandSubMode, setCommandSubMode] = useState('dockerrun'); // 'dockerrun' | 'compose'
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
        sysctls: [],
        privileged: false,
    });
    const [showIconInput, setShowIconInput] = useState(false);
    const [showWebUiInput, setShowWebUiInput] = useState(false);
    const [customNetwork, setCustomNetwork] = useState('');
    const [networkIp, setNetworkIp] = useState('');

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
            // 判断是否为自定义网络（非内置的 bridge/host/none）
            const builtinNetworks = ['bridge', 'host', 'none'];
            const initNetwork = initialData.network || 'bridge';
            const isCustomNet = !builtinNetworks.includes(initNetwork);
            setFormData({
                name: initialData.name || '',
                image: initialData.image || '',
                iconUrl: initialData.iconUrl || '',
                webUi: initialData.webUi || '',
                ports: initialData.ports || [],
                volumes: initialData.volumes || [],
                env: initialData.env || [],
                restart: initialData.restart || 'always',
                network: isCustomNet ? 'custom' : initNetwork,
                alwaysPull: false,
                entrypoint: initialData.entrypoint || '',
                cmd: initialData.cmd || '',
                capAdd: (initialData.capAdd || []).map(c =>
                    // Docker API 返回的格式带 CAP_ 前缀（如 CAP_NET_ADMIN）而复选框使用无前缀格式（NET_ADMIN）
                    // 统一去掉 CAP_ 前缀，避免重建时重复添加
                    c.startsWith('CAP_') ? c.slice(4) : c
                ),
                devices: initialData.devices || [],
                sysctls: initialData.sysctls || [],
                privileged: initialData.privileged || false,
            });
            if (isCustomNet) setCustomNetwork(initNetwork);
            if (initialData.iconUrl) setShowIconInput(true);
            if (initialData.webUi) setShowWebUiInput(true);
        }
    }, [initialData]);

    const lastAutoFillRef = useRef('');

    // Auto-fill WebUI when ports change or when adding WebUI
    useEffect(() => {
        if (showWebUiInput) {
            // currentEndpoint 是字符串ID，需要从 endpoints 数组里找完整对象取 host
            let host = '';
            if (currentEndpoint && currentEndpoint !== 'local') {
                const endpointObj = endpoints.find(ep => ep.id === currentEndpoint);
                host = endpointObj?.host || '';
            }
            // 本地节点或找不到 host 时，用访问域名/IP作为兜底
            if (!host) {
                host = window.location.hostname;
            }

            // Try to find a port
            let port = '';
            if (formData.ports.length > 0) {
                const firstPort = formData.ports[0];
                if (firstPort && firstPort.includes(':')) {
                    const hostPort = firstPort.split(':')[0];
                    if (!isNaN(hostPort)) {
                        port = hostPort;
                    }
                } else if (firstPort && !isNaN(firstPort)) {
                    port = firstPort;
                }
            }
            
            const newAutoFill = port ? `${host}:${port}` : host;
            
            // Only overwrite if it's empty, or matches our last auto-fill, or is the old buggy 'localhost:'
            if (!formData.webUi || formData.webUi === lastAutoFillRef.current || formData.webUi === 'localhost:') {
                lastAutoFillRef.current = newAutoFill;
                setFormData(prev => ({ ...prev, webUi: newAutoFill }));
            }
        }
    }, [showWebUiInput, currentEndpoint, endpoints, formData.ports]); // Trigger when input is shown, endpoint changes or ports change

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

        const defaultData = {
            name: '',
            image: '',
            iconUrl: '',
            webUi: '',
            ports: [],
            volumes: [],
            env: [],
            restart: 'always',
            network: 'bridge',
            alwaysPull: false,
            entrypoint: '',
            cmd: '',
            capAdd: [],
            devices: [],
            sysctls: []
        };

        if (!templateId) {
            // 清空表单
            setFormData(defaultData);
            setShowIconInput(false);
            setShowWebUiInput(false);
            return;
        }

        const template = templates.find(t => t.id === templateId);
        if (template) {
            const tData = template.data;
            setFormData({
                ...defaultData,
                ...tData,
                // Ensure arrays are initialized
                ports: tData.ports || [],
                volumes: tData.volumes || [],
                env: tData.env || [],
                capAdd: (tData.capAdd || []).map(c => c.startsWith('CAP_') ? c.slice(4) : c),
                devices: tData.devices || [],
                sysctls: tData.sysctls || [],
                privileged: tData.privileged || false,
            });
            // 回填自定义网络名和静态 IP（独立 state）
            if (tData.customNetwork) setCustomNetwork(tData.customNetwork);
            if (tData.networkIp) setNetworkIp(tData.networkIp);
            if (tData.iconUrl) setShowIconInput(true);
            if (tData.webUi) setShowWebUiInput(true);
        }
    };

    const parseDockerCommand = () => {
        if (!command.trim()) return;

        try {
            // 简单的 docker run 命令解析逻辑
            // 移除换行符和反斜杠
            const cleanCmd = command.replace(/\\\n/g, ' ').replace(/\n/g, ' ');

            // 更好的词法分析器，支持单双引号提取带空格的参数
            const args = [];
            let current = '';
            let inQuotes = false;
            let quoteChar = null;

            for (let i = 0; i < cleanCmd.length; i++) {
                const char = cleanCmd[i];
                if ((char === '"' || char === "'") && (i === 0 || cleanCmd[i - 1] !== '\\')) {
                    if (inQuotes && quoteChar === char) {
                        inQuotes = false;
                        quoteChar = null;
                    } else if (!inQuotes) {
                        inQuotes = true;
                        quoteChar = char;
                    } else {
                        current += char;
                    }
                } else if (char === ' ' && !inQuotes) {
                    if (current.trim().length > 0) {
                        args.push(current.trim());
                    }
                    current = '';
                } else {
                    current += char;
                }
            }
            if (current.trim().length > 0) {
                args.push(current.trim());
            }

            // 处理 key=value 参数形式 (如 --restart=always)
            const parsedArgs = [];
            for (let i = 0; i < args.length; i++) {
                if (args[i].startsWith('--') && args[i].includes('=')) {
                    const idx = args[i].indexOf('=');
                    parsedArgs.push(args[i].substring(0, idx));
                    parsedArgs.push(args[i].substring(idx + 1));
                } else {
                    parsedArgs.push(args[i]);
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
                sysctls: [],
                privileged: false,
            };

            const knownValueFlags = ['-u', '--user', '-w', '--workdir', '-m', '--memory', '--cpus', '--gpus', '--shm-size', '--mac-address', '--hostname', '-h', '--dns', '--ip', '--network-alias', '--add-host'];

            let imageFound = false;

            for (let i = 0; i < parsedArgs.length; i++) {
                const arg = parsedArgs[i];
                
                if (imageFound) {
                    if (newData.cmd) newData.cmd += ' ' + arg;
                    else newData.cmd = arg;
                    continue;
                }

                if (arg === 'docker' || arg === 'run' || arg === '-d' || arg === '--detach' || arg === '-it') {
                    continue;
                }
                
                if (arg === '--privileged') {
                    newData.privileged = true;
                } else if (arg === '--name') {
                    newData.name = parsedArgs[++i];
                } else if (arg === '-p' || arg === '--publish') {
                    newData.ports.push(parsedArgs[++i]);
                } else if (arg === '-v' || arg === '--volume') {
                    newData.volumes.push(parsedArgs[++i]);
                } else if (arg === '-e' || arg === '--env') {
                    newData.env.push(parsedArgs[++i]);
                } else if (arg === '--restart') {
                    newData.restart = parsedArgs[++i];
                } else if (arg === '--net' || arg === '--network') {
                    newData.network = parsedArgs[++i];
                } else if (arg === '--entrypoint') {
                    newData.entrypoint = parsedArgs[++i];
                } else if (arg === '--cap-add') {
                    newData.capAdd.push(parsedArgs[++i]);
                } else if (arg === '--device') {
                    const device = parsedArgs[++i];
                    if (device) {
                        const parts = device.split(':');
                        newData.devices.push({
                            PathOnHost: parts[0] || '',
                            PathInContainer: parts[1] || parts[0] || '',
                            CgroupPermissions: parts[2] || 'rwm'
                        });
                    }
                } else if (arg === '--sysctl') {
                    const sysctl = parsedArgs[++i];
                    if (sysctl) {
                        const idx = sysctl.indexOf('=');
                        if (idx !== -1) {
                            newData.sysctls.push({ key: sysctl.substring(0, idx), value: sysctl.substring(idx + 1) });
                        }
                    }
                } else if (arg === '-l' || arg === '--label') {
                    const label = parsedArgs[++i];
                    if (label) {
                        if (label.startsWith('WEBUI_URL=')) {
                            let val = label.substring('WEBUI_URL='.length);
                            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                                val = val.substring(1, val.length - 1);
                            }
                            newData.webUi = val;
                            setShowWebUiInput(true);
                        } else if (label.startsWith('ICON_URL=')) {
                            let val = label.substring('ICON_URL='.length);
                            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                                val = val.substring(1, val.length - 1);
                            }
                            newData.iconUrl = val;
                            setShowIconInput(true);
                        }
                    }
                } else if (arg === '--webui') {
                    newData.webUi = parsedArgs[++i];
                    setShowWebUiInput(true);
                } else if (arg === '--icon') {
                    newData.iconUrl = parsedArgs[++i];
                    setShowIconInput(true);
                } else if (knownValueFlags.includes(arg)) {
                    // skip known flag values we don't handle
                    i++;
                } else if (arg.startsWith('-')) {
                    // skip unknown flags. Assume it's a boolean flag. Do not skip next.
                } else {
                    // First non-flag argument is the image
                    newData.image = arg;
                    imageFound = true;
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
                let imageEncountered = false;

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
                        // 如果 image 已经出现过，后面的就是 CMD 参数，每个独占一行
                        if (imageEncountered) {
                            if (currentLine.length > 0) lines.push(currentLine);
                            currentLine = [token];
                        } else {
                            if (currentLine.length > 0) lines.push(currentLine);
                            currentLine = [token];
                        }
                    } else {
                        if (!imageEncountered && currentLine.length > 0 && !currentLine[currentLine.length - 1].startsWith('-')) {
                            // 当前 currentLine 最后一个 token 不是 flag（说明它就是上一个専名的值），则此 token 开始新行
                            lines.push(currentLine);
                            currentLine = [token];
                            imageEncountered = true;
                        } else if (!imageEncountered && currentLine.length === 1 && currentLine[0].startsWith('-') && !currentLine[0].startsWith('--')) {
                            // 短 flag （如 -d）的值
                            currentLine.push(token);
                        } else if (!imageEncountered && currentLine.length === 1 && currentLine[0].startsWith('--')) {
                            // 长 flag 的值——检查下一个 token 是否是新 flag 或 image
                            currentLine.push(token);
                        } else if (imageEncountered) {
                            // image 后面的 CMD，独占一行
                            if (currentLine.length > 0) lines.push(currentLine);
                            currentLine = [token];
                        } else {
                            currentLine.push(token);
                        }
                    }
                });
                if (currentLine.length > 0) lines.push(currentLine);

                // 最终渲染：image 行特殊高亮（白色加粗）、flag 黄色、其他灰色
                const isImageLine = (lineTokens) =>
                    lineTokens.length === 1 &&
                    !lineTokens[0].startsWith('-') &&
                    (lineTokens[0].includes('/') || lineTokens[0].includes(':'));

                return (
                    <div key={index} className={`pl-4 mb-4 font-mono text-sm break-all p-3 rounded-lg border ${isDark ? 'bg-black/30 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                        <div className={`space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {lines.map((lineTokens, i) => (
                                <div key={i} className={`${i > 0 ? 'pl-4' : ''}`}>
                                    {lineTokens.map((token, j) => {
                                        const isFlag = token.startsWith('-');
                                        const isImg = isImageLine(lineTokens);
                                        return (
                                            <span key={j} className={`mr-2 ${
                                                i === 0 ? (isDark ? 'text-cyan-400 font-bold' : 'text-cyan-600 font-bold')
                                                : isImg ? (isDark ? 'text-white font-semibold' : 'text-gray-900 font-semibold')
                                                : isFlag ? (isDark ? 'text-yellow-400' : 'text-yellow-600')
                                                : (isDark ? 'text-gray-300' : 'text-gray-600')
                                            }`}>
                                                {token}
                                            </span>
                                        );
                                    })}
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
                // 编辑模式：带上旧容器 ID，后端用 ID 查找旧容器（改名后也能正确检测自更新）
                containerId: isEdit ? initialData.containerId : undefined,
                ports: formData.ports.filter(p => p.trim()),
                volumes: formData.volumes.filter(v => v.trim()),
                env: formData.env.filter(e => e.trim()),
                restart: formData.restart,
                network: formData.network === 'custom' ? (customNetwork.trim() || 'bridge') : formData.network,
                // 静态 IP：仅自定义网络有效，内置网络（bridge/host/none）忽略
                networkIp: (formData.network === 'custom' && networkIp.trim()) ? networkIp.trim() : undefined,
                labels: labels,

                alwaysPull: formData.alwaysPull,
                entrypoint: formData.entrypoint && formData.entrypoint.trim() ? formData.entrypoint.trim().split(' ') : undefined,
                cmd: formData.cmd && formData.cmd.trim() ? formData.cmd.trim().split(' ') : undefined,
                capAdd: formData.capAdd.filter(c => c.trim()),
                devices: formData.devices.filter(d => d.PathOnHost && d.PathInContainer),
                sysctls: formData.sysctls.reduce((acc, curr) => {
                    if (curr.key && curr.value) acc[curr.key] = curr.value;
                    return acc;
                }, {}),
                privileged: formData.privileged || false,
            };


            // 自动保存为模板（含自定义网络名和静态IP）
            try {
                await axios.post('/api/templates/user', {
                    name: formData.name,
                    data: {
                        ...formData,
                        // customNetwork 和 networkIp 是独立 state，需显式合入
                        customNetwork: formData.network === 'custom' ? customNetwork : '',
                        networkIp: (formData.network === 'custom' && networkIp.trim()) ? networkIp.trim() : '',
                    }
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
                                    {/* 子模式切换：docker run / compose */}
                                    <div className={`flex rounded-lg p-1 gap-1 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                                        <button
                                            type="button"
                                            onClick={() => setCommandSubMode('dockerrun')}
                                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                                commandSubMode === 'dockerrun'
                                                    ? (isDark ? 'bg-gray-700 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm')
                                                    : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                                            }`}
                                        >
                                            <Terminal className="w-3.5 h-3.5" />
                                            Docker Run
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setCommandSubMode('compose'); setComposeError(''); }}
                                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                                commandSubMode === 'compose'
                                                    ? (isDark ? 'bg-gray-700 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm')
                                                    : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                                            }`}
                                        >
                                            <Layout className="w-3.5 h-3.5" />
                                            Compose
                                        </button>
                                    </div>

                                    {/* Docker Run 区块 */}
                                    {commandSubMode === 'dockerrun' && (
                                        <div className={`rounded-xl border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                                            <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                                                <Terminal className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                                                <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>docker run 命令</span>
                                                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>支持直接运行</span>
                                            </div>
                                            <div className="p-4">
                                                <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    粘贴完整的 docker run 命令，可解析填入表单或直接运行
                                                </p>
                                                <textarea
                                                    value={command}
                                                    onChange={(e) => setCommand(e.target.value)}
                                                    placeholder="docker run -d --name my-app -p 8080:80 nginx:latest"
                                                    className={`w-full h-36 p-3 rounded-lg font-mono text-sm resize-none ${
                                                        isDark ? 'bg-black/30 text-white placeholder-gray-600 border border-white/5' : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400'
                                                    } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Compose 区块 */}
                                    {commandSubMode === 'compose' && (
                                        <div className={`rounded-xl border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                                            <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                                                <Layout className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                                <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Compose 配置（单服务）</span>
                                                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>仅解析填入表单</span>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    粘贴单容器 Compose YAML，解析后填入表单。支持完整 compose 文件（只含单个 service）或直接贴服务配置块。
                                                </p>
                                                <textarea
                                                    value={composeContent}
                                                    onChange={(e) => { setComposeContent(e.target.value); setComposeError(''); }}
                                                    placeholder={`services:\n  myapp:\n    image: nginx:latest\n    ports:\n      - "8080:80"\n    volumes:\n      - /data:/data\n    restart: always`}
                                                    className={`w-full h-52 p-3 rounded-lg font-mono text-sm resize-none ${
                                                        isDark ? 'bg-black/30 text-white placeholder-gray-600 border border-white/5' : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400'
                                                    } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                                                />
                                                {composeError && (
                                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                                        <p className="text-xs text-red-400">{composeError}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
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
                                                        <GlassSelect
                                                            value={selectedTemplate}
                                                            onChange={(val) => handleTemplateSelect({ target: { value: val } })}
                                                            isDark={isDark}
                                                            size="sm"
                                                            className="flex-1"
                                                            options={[
                                                                { value: '', label: t('container.no_template') },
                                                                ...templates.map(tmpl => ({ value: tmpl.id, label: tmpl.name }))
                                                            ]}
                                                        />
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
                                                    <GlassSelect
                                                        value={formData.restart}
                                                        onChange={(val) => setFormData({ ...formData, restart: val })}
                                                        isDark={isDark}
                                                        options={[
                                                            { value: 'no', label: t('common.restart_no') },
                                                            { value: 'always', label: t('common.restart_always') },
                                                            { value: 'on-failure', label: t('common.restart_on_failure') },
                                                            { value: 'unless-stopped', label: t('common.restart_unless_stopped') },
                                                        ]}
                                                    />
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
                                                    <GlassSelect
                                                        value={formData.network}
                                                        onChange={(val) => setFormData({ ...formData, network: val })}
                                                        isDark={isDark}
                                                        options={[
                                                            { value: 'bridge', label: t('common.network_bridge') },
                                                            { value: 'host', label: t('common.network_host') },
                                                            { value: 'none', label: t('common.network_none') },
                                                            { value: 'custom', label: t('common.network_custom') },
                                                        ]}
                                                    />
                                                    {formData.network === 'custom' && (
                                                        <div className="mt-2 space-y-2">
                                                            {/* 自定义网络名 */}
                                                            <input
                                                                type="text"
                                                                value={customNetwork}
                                                                onChange={(e) => setCustomNetwork(e.target.value)}
                                                                placeholder={t('container.network_custom_placeholder', '例：my-network 或 nginx_default')}
                                                                autoFocus
                                                                className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white placeholder-gray-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                            />
                                                            {/* 静态 IP（可选，仅支持有 IPAM 的网络，如 macvlan） */}
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={networkIp}
                                                                    onChange={(e) => setNetworkIp(e.target.value)}
                                                                    placeholder={t('container.network_ip_placeholder', '静态 IP（可选）例：192.168.1.100')}
                                                                    className={`w-full px-4 py-2 rounded-lg ${isDark ? 'glass text-white placeholder-gray-500' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                                                                />
                                                            </div>
                                                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {t('container.network_ip_hint', '静态 IP 仅适用于已配置 IPAM（如 macvlan/ipvlan）的自定义网络')}
                                                            </p>
                                                        </div>
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

                                                {/* Privileged Mode */}
                                                <div className={`p-4 rounded-xl border transition-all ${
                                                    formData.privileged
                                                        ? isDark
                                                            ? 'border-orange-500/40 bg-orange-500/10'
                                                            : 'border-orange-400 bg-orange-50'
                                                        : isDark
                                                            ? 'border-white/10 bg-white/5'
                                                            : 'border-gray-200 bg-gray-50'
                                                }`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Shield className={`w-5 h-5 ${formData.privileged ? 'text-orange-400' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                                            <div>
                                                                <div className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                    特权模式 (Privileged)
                                                                </div>
                                                                <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                    等价于 <code className="font-mono bg-black/20 px-1 rounded">--privileged</code>，授予容器几乎所有 capabilities 并允许访问宿主设备
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Toggle switch */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, privileged: !prev.privileged }))}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                                                formData.privileged ? 'bg-orange-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                                                            }`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                                                formData.privileged ? 'translate-x-6' : 'translate-x-1'
                                                            }`} />
                                                        </button>
                                                    </div>
                                                    {formData.privileged && (
                                                        <div className={`mt-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${isDark ? 'bg-orange-900/30 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>
                                                            <span>⚠️</span>
                                                            <span>特权模式会绕过容器安全隔离，仅在确实需要时启用（如 Docker-in-Docker、NFS 挂载等场景）。</span>
                                                        </div>
                                                    )}
                                                </div>

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
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                        {['NET_ADMIN', 'SYS_ADMIN', 'SYS_MODULE', 'SYS_PTRACE', 'NET_RAW', 'IPC_LOCK', 'SYS_NICE', 'SYS_TIME', 'SYS_RESOURCE', 'DAC_READ_SEARCH'].map((cap) => (
                                                            <label key={cap} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${formData.capAdd.includes(cap) ? (isDark ? 'border-cyan-500 bg-cyan-500/10' : 'border-cyan-500 bg-cyan-50') : (isDark ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50')}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.capAdd.includes(cap)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setFormData(prev => ({ ...prev, capAdd: [...prev.capAdd, cap] }));
                                                                        } else {
                                                                            setFormData(prev => ({ ...prev, capAdd: prev.capAdd.filter(c => c !== cap) }));
                                                                        }
                                                                    }}
                                                                    className="w-4 h-4 text-cyan-500 rounded border-gray-300 focus:ring-cyan-500"
                                                                />
                                                                <span className={`text-sm font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{cap}</span>
                                                            </label>
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
                                {mode === 'command' && commandSubMode === 'dockerrun' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={parseDockerCommand}
                                            className={`flex-1 px-4 py-3 rounded-lg font-medium border transition-colors ${
                                                isDark
                                                    ? 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10'
                                                    : 'border-cyan-300 text-cyan-600 hover:bg-cyan-50'
                                            }`}
                                        >
                                            解析并填入表单
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
                                            className="flex-1 px-4 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/20 transition-all"
                                        >
                                            直接运行
                                        </button>
                                    </>
                                )}
                                {mode === 'command' && commandSubMode === 'compose' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!composeContent.trim()) {
                                                setComposeError('请先输入 Compose 配置');
                                                return;
                                            }
                                            try {
                                                const res = await axios.post('/api/parse-compose', { content: composeContent });
                                                const d = res.data.data;
                                                // 填入表单
                                                const builtins = ['bridge','host','none'];
                                                const isCustomNet = d.network && !builtins.includes(d.network);
                                                setFormData(prev => ({
                                                    ...prev,
                                                    name: d.name || prev.name,
                                                    image: d.image || prev.image,
                                                    ports: d.ports?.length ? d.ports : prev.ports,
                                                    volumes: d.volumes?.length ? d.volumes : prev.volumes,
                                                    env: d.env?.length ? d.env : prev.env,
                                                    restart: d.restart || prev.restart,
                                                    network: isCustomNet ? 'custom' : (d.network || 'bridge'),
                                                    entrypoint: d.entrypoint || prev.entrypoint,
                                                    cmd: d.cmd || prev.cmd,
                                                    capAdd: d.capAdd?.length ? d.capAdd : prev.capAdd,
                                                    devices: d.devices?.length ? d.devices : prev.devices,
                                                    sysctls: d.sysctls && Object.keys(d.sysctls).length
                                                        ? Object.entries(d.sysctls).map(([k,v]) => `${k}=${v}`)
                                                        : prev.sysctls,
                                                    iconUrl: d.iconUrl || prev.iconUrl,
                                                    webUi: d.webUi || prev.webUi,
                                                    alwaysPull: false,
                                                    privileged: d.privileged === true ? true : prev.privileged,
                                                }));
                                                if (isCustomNet) setCustomNetwork(d.network);
                                                if (d.iconUrl) setShowIconInput(true);
                                                if (d.webUi) setShowWebUiInput(true);
                                                setComposeError('');
                                                // 切回表单模式
                                                setMode('form');
                                                setActiveTab('general');
                                            } catch (err) {
                                                setComposeError(err.response?.data?.error || err.message || '解析失败');
                                            }
                                        }}
                                        className="w-full px-4 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-lg shadow-purple-500/20 transition-all"
                                    >
                                        解析并填入表单
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

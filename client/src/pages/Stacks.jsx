import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import {
    LayoutDashboard,
    Container,
    Image,
    Boxes,
    HardDrive,
    Network,
    Server,
    LogOut,
    Sun,
    Moon,
    Globe,
    Plus,
    Play,
    Square,
    Trash2,
    Edit,
    Eye,
    RefreshCw,
    FileText,
    Copy,
    AlertTriangle,
    CheckCircle2,
    Hammer,
    FilePlus
} from 'lucide-react';
import DeployStackModal from '../components/DeployStackModal';
import AddComposeModal from '../components/AddComposeModal';
import { APP_VERSION } from '../constants';
import { useThemeStore } from '../store/themeStore';
import { useEndpoint } from '../context/EndpointContext';
import axios from 'axios';
import EndpointSelector from '../components/EndpointSelector';
import ComposeEditor from '../components/ComposeEditor';
import EnvironmentVariables from '../components/EnvironmentVariables';
import { validateCompose } from '../utils/validators';

export default function Stacks() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useThemeStore();
    const { refreshEndpoints, currentEndpoint, endpoints } = useEndpoint();

    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('dma_stacks_active_tab') || 'stacks';
    });
    const [stacks, setStacks] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);

    const isLocalEndpoint = useMemo(() => {
        const current = endpoints.find(ep => ep.id === currentEndpoint);
        return current?.type === 'local';
    }, [endpoints, currentEndpoint]);

    const [showCreateStackModal, setShowCreateStackModal] = useState(false);
    const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
    const [showEditTemplateModal, setShowEditTemplateModal] = useState(false);
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [showDeployStackModal, setShowDeployStackModal] = useState(false);
    const [showAddComposeModal, setShowAddComposeModal] = useState(false);
    const [deployingStackName, setDeployingStackName] = useState('');
    const [isNewStack, setIsNewStack] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [selectedExternalStack, setSelectedExternalStack] = useState('');

    // 新增状态
    const [deployModal, setDeployModal] = useState({ show: false, stackName: '', isNew: false, pull: false });
    const [rebuildModal, setRebuildModal] = useState({ show: false, stackName: '' });
    const [deleteStackModal, setDeleteStackModal] = useState({ show: false, stackName: '' });

    const [newStackName, setNewStackName] = useState('');
    const [newStackContent, setNewStackContent] = useState('');
    const [newStackDescription, setNewStackDescription] = useState('');
    const [newStackEnv, setNewStackEnv] = useState([]);

    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDescription, setNewTemplateDescription] = useState('');
    const [newTemplateContent, setNewTemplateContent] = useState('');
    const [newTemplateEnv, setNewTemplateEnv] = useState([]);

    const [editTemplateName, setEditTemplateName] = useState('');
    const [editTemplateDescription, setEditTemplateDescription] = useState('');
    const [editTemplateContent, setEditTemplateContent] = useState('');
    const [editTemplateEnv, setEditTemplateEnv] = useState([]);

    const handleRebuild = (stackName) => {
        setRebuildModal({ show: true, stackName });
    };

    const confirmRebuild = (alwaysPull) => {
        const stackName = rebuildModal.stackName;
        setRebuildModal({ show: false, stackName: '' });
        setDeployingStackName(stackName);
        setIsNewStack(false);
        // 更新 deployModal 状态以传递 pull 参数
        setDeployModal({ show: true, stackName, isNew: false, pull: alwaysPull });
        setShowDeployStackModal(true);
    };

    const [newStackError, setNewStackError] = useState(null);
    const [newTemplateError, setNewTemplateError] = useState(null);
    const [editTemplateError, setEditTemplateError] = useState(null);

    useEffect(() => {
        localStorage.setItem('dma_stacks_active_tab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        refreshEndpoints();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setStacks([]);
        setTemplates([]);
        fetchStacks(controller.signal);
        fetchTemplates(controller.signal);

        return () => {
            controller.abort();
        };
    }, [currentEndpoint]);

    useEffect(() => {
        setNewStackError(validateCompose(newStackContent));
    }, [newStackContent]);

    useEffect(() => {
        setNewTemplateError(validateCompose(newTemplateContent));
    }, [newTemplateContent]);

    useEffect(() => {
        setEditTemplateError(validateCompose(editTemplateContent));
    }, [editTemplateContent]);

    const fetchStacks = async (signal) => {
        // 只有在没有数据时才显示加载状态，实现"后台刷新"体验
        if (stacks.length === 0) {
            setLoading(true);
        }
        try {
            const response = await axios.get('/api/stacks', { signal });
            setStacks(response.data);
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error('Failed to fetch stacks:', error);
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    const fetchTemplates = async (signal) => {
        try {
            const response = await axios.get('/api/stacks/templates', { signal });
            setTemplates(response.data);
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error('Failed to fetch templates:', error);
            }
        }
    };

    const handleCreateStack = async () => {
        if (!newStackName || !newStackContent) {
            alert(t('stacks.input_required'));
            return;
        }

        try {
            const response = await axios.post('/api/stacks', {
                name: newStackName,
                composeContent: newStackContent,
                description: newStackDescription,
                env: newStackEnv
            });

            if (response.data.error) {
                alert(t('stacks.create_fail') + ': ' + response.data.error);
                return;
            }

            setShowCreateStackModal(false);
            setDeployingStackName(newStackName);
            setIsNewStack(true);
            setShowDeployStackModal(true);

            setNewStackName('');
            setNewStackContent('');
            setNewStackDescription('');
            setNewStackEnv([]);
            fetchStacks();
            fetchTemplates();
        } catch (error) {

            alert(t('stacks.create_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleCreateTemplate = async () => {
        if (!newTemplateName || !newTemplateContent) {
            alert(t('stacks.input_required'));
            return;
        }

        try {
            const response = await axios.post('/api/stacks/templates', {
                name: newTemplateName,
                title: newTemplateName,
                description: newTemplateDescription,
                category: 'Custom',

                composeContent: newTemplateContent,
                env: newTemplateEnv.map(e => ({ name: e.name, default: e.value, label: e.name }))
            });
            setShowCreateTemplateModal(false);
            setNewTemplateName('');
            setNewTemplateDescription('');
            setNewTemplateContent('');
            setNewTemplateEnv([]);
            await fetchTemplates();
        } catch (error) {

            alert(t('stacks.create_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDeployFromTemplate = async (stackName, env) => {
        if (!stackName) {
            alert(t('stacks.input_name_required'));
            return;
        }

        try {
            await axios.post(`/api/stacks/templates/${selectedTemplate.name}/deploy`, {
                stackName,
                env,
                skipDeploy: true
            });
            setShowDeployModal(false);
            setDeployingStackName(stackName);
            setIsNewStack(true);
            setShowDeployStackModal(true);

            setSelectedTemplate(null);
            setActiveTab('stacks');
            fetchStacks();
        } catch (error) {

            alert(t('stacks.deploy_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleSaveAsTemplate = async (stackName) => {
        try {
            const response = await axios.get(`/api/stacks/${stackName}`);
            const stack = response.data;

            if (stack.composeContent) {
                setNewTemplateName(stackName + '-template');
                setNewTemplateDescription(`Created from stack ${stackName}`);
                setNewTemplateContent(stack.composeContent);
                setShowCreateTemplateModal(true);
            } else {
                alert(t('stacks.get_content_fail'));
            }
        } catch (error) {
            alert(t('stacks.get_detail_fail') + ': ' + error.message);
        }
    };

    const handleStartStack = async (name) => {
        try {
            await axios.post(`/api/stacks/${name}/start`);
            fetchStacks();
        } catch (error) {

            alert(t('stacks.start_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleStopStack = async (name) => {
        try {
            await axios.post(`/api/stacks/${name}/stop`);
            fetchStacks();
        } catch (error) {

            alert(t('stacks.stop_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleRestartStack = async (name) => {
        try {
            await axios.post(`/api/stacks/${name}/restart`);
            fetchStacks();
        } catch (error) {

            alert(t('stacks.restart_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDeleteStack = (name) => {
        setDeleteStackModal({ show: true, stackName: name });
    };

    const confirmDeleteStack = async (removeImages) => {
        const name = deleteStackModal.stackName;
        try {
            await axios.delete(`/api/stacks/${name}`, {
                params: { removeImages },
                headers: { 'x-endpoint-id': currentEndpoint }
            });
            setDeleteStackModal({ show: false, stackName: '' });
            fetchStacks();
        } catch (error) {
            alert(t('stacks.delete_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDeleteTemplate = async (name) => {
        if (!confirm(t('stacks.delete_template_confirm', { name }))) return;

        try {
            await axios.delete(`/api/stacks/templates/${name}`);
            fetchTemplates();
        } catch (error) {
            alert(t('stacks.delete_fail_msg') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleEditTemplate = async (template) => {
        try {
            const response = await axios.get(`/api/stacks/templates/${template.name}`);
            setEditingTemplate(response.data);
            setEditTemplateName(response.data.title || response.data.name);
            setEditTemplateDescription(response.data.description || '');
            setEditTemplateContent(response.data.composeContent || '');
            setEditTemplateContent(response.data.composeContent || '');
            setEditTemplateEnv((response.data.env || []).map(e => ({ name: e.name, value: e.default || e.value || '' })));
            setShowEditTemplateModal(true);
        } catch (error) {

            alert(t('stacks.get_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleSaveEditTemplate = async () => {
        if (!editTemplateName || !editTemplateContent) {
            alert(t('stacks.input_required'));
            return;
        }

        try {
            await axios.put(`/api/stacks/templates/${editingTemplate.name}`, {
                title: editTemplateName,
                description: editTemplateDescription,
                composeContent: editTemplateContent,
                env: editTemplateEnv.map(e => ({ name: e.name, default: e.value, label: e.name }))
            });
            setShowEditTemplateModal(false);
            setEditingTemplate(null);
            setEditTemplateName('');
            setEditTemplateDescription('');
            setEditTemplateContent('');
            await fetchTemplates();
        } catch (error) {
            alert(t('stacks.save_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const [initialComposeContent, setInitialComposeContent] = useState('');

    const handleAddConfig = (stackName) => {
        setInitialComposeContent('');
        setSelectedExternalStack(stackName);
        setShowAddComposeModal(true);
    };

    const handleEditConfig = async (stackName) => {
        try {
            const res = await axios.get(`/api/stacks/${stackName}/compose`);
            setInitialComposeContent(res.data.content);
            setSelectedExternalStack(stackName);
            setShowAddComposeModal(true);
        } catch (error) {

            alert(t('stacks.get_fail') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleSaveConfig = async (composeContent, description) => {
        try {
            await axios.post(`/api/stacks/${selectedExternalStack}/import-config`, {
                composeContent,
                description
            });

            setShowAddComposeModal(false);
            setSelectedExternalStack('');
            await fetchStacks(); // 刷新列表
        } catch (error) {
            alert(t('stacks.save_fail_msg') + ': ' + (error.response?.data?.error || error.message));
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('dma_token');
        navigate('/login');
    };

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
    };

    const isDark = theme === 'dark';

    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'bg-green-500';
            case 'stopped': return 'bg-gray-500';
            case 'partial': return 'bg-yellow-500';
            default: return 'bg-red-500';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'running': return t('stacks.status_running');
            case 'stopped': return t('stacks.status_stopped');
            case 'partial': return t('stacks.status_partial');
            default: return t('stacks.status_unknown');
        }
    };

    return (
        <div className={isDark ? 'min-h-screen bg-gray-950' : 'min-h-screen bg-gray-50'}>
            <aside className={`fixed left-0 top-0 h-full w-72 ${isDark ? 'glass border-r border-white/10' : 'bg-white border-r border-gray-200 shadow-sm'} p-4`}>
                <div className="mb-8 pb-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 flex-shrink-0">
                            <img src="/logo.png" alt="DMA Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <h1 className={`text-base font-bold leading-tight ${isDark ? 'bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent' : 'text-gray-900'}`}>
                                    Docker Manager
                                </h1>
                                <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{APP_VERSION}</span>
                            </div>
                            <p className={`text-sm leading-tight ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('app.description')}
                            </p>
                        </div>
                    </div>
                </div>

                <nav className="space-y-2">
                    <NavItem icon={<LayoutDashboard />} label={t('nav.dashboard')} onClick={() => navigate('/')} isDark={isDark} />
                    <NavItem icon={<Container />} label={t('nav.containers')} onClick={() => navigate('/containers')} isDark={isDark} />
                    <NavItem icon={<Boxes />} label={t('nav.stacks')} active isDark={isDark} />
                    <NavItem icon={<Image />} label={t('nav.images')} onClick={() => navigate('/images')} isDark={isDark} />
                    <NavItem icon={<HardDrive />} label={t('nav.volumes')} onClick={() => navigate('/volumes')} isDark={isDark} />
                    <NavItem icon={<Network />} label={t('nav.networks')} onClick={() => navigate('/networks')} isDark={isDark} />
                    <NavItem icon={<Server />} label={t('nav.endpoints')} onClick={() => navigate('/endpoints')} isDark={isDark} />
                </nav>

                <div className="absolute bottom-4 left-4 right-4 space-y-3">
                    <EndpointSelector isDark={isDark} popupDirection="up" />
                    <button
                        onClick={handleLogout}
                        className={`w-full ${isDark ? 'glass glass-hover' : 'bg-red-50 hover:bg-red-100'} p-3 rounded-lg flex items-center gap-2 text-red-400 transition-colors`}
                    >
                        <LogOut className="w-5 h-5" />
                        {t('auth.logout')}
                    </button>
                </div>
            </aside>

            <main className="ml-72 p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('nav.stacks')}
                        </h1>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {activeTab === 'stacks'
                                ? t('stacks.total_stacks', { count: stacks.length })
                                : t('stacks.total_templates', { count: templates.length })
                            }
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => activeTab === 'stacks' ? setShowCreateStackModal(true) : setShowCreateTemplateModal(true)}
                            className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${isDark
                                ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                                }`}
                            title={activeTab === 'stacks' ? t('stacks.create_stack_title') : t('stacks.create_template_title')}
                        >
                            <Plus className="w-5 h-5" />
                            <span>{activeTab === 'stacks' ? t('stacks.create_stack') : t('stacks.create_template')}</span>
                        </button>
                        <button
                            onClick={toggleLanguage}
                            className={`${isDark ? 'glass glass-hover text-white' : 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-700'} p-3 rounded-lg transition-all`}
                        >
                            <Globe className="w-5 h-5" />
                        </button>
                        <button
                            onClick={toggleTheme}
                            className={`${isDark ? 'glass glass-hover text-white' : 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-700'} p-3 rounded-lg transition-all`}
                        >
                            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('stacks')}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'stacks'
                            ? isDark
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-cyan-50 text-cyan-600 border border-cyan-200'
                            : isDark
                                ? 'text-gray-400 hover:bg-white/5 border border-transparent'
                                : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <Boxes className="w-5 h-5" />
                            <span>{t('stacks.deployed_stacks')}</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'templates'
                            ? isDark
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-cyan-50 text-cyan-600 border border-cyan-200'
                            : isDark
                                ? 'text-gray-400 hover:bg-white/5 border border-transparent'
                                : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            <span>{t('stacks.templates_lib')}</span>
                        </div>
                    </button>
                </div>

                {activeTab === 'stacks' ? (
                    <StacksGrid
                        stacks={stacks}
                        loading={loading}
                        isDark={isDark}
                        onStart={handleStartStack}
                        onStop={handleStopStack}
                        onRestart={handleRestartStack}
                        onRebuild={handleRebuild}
                        onDelete={handleDeleteStack}
                        onAddConfig={handleAddConfig}
                        onEditConfig={handleEditConfig}
                        getStatusColor={getStatusColor}
                        getStatusText={getStatusText}
                        onSaveAsTemplate={handleSaveAsTemplate}
                    />
                ) : (
                    <TemplatesGrid
                        templates={templates}
                        isDark={isDark}
                        onDeploy={(template) => {
                            setSelectedTemplate(template);
                            setShowDeployModal(true);
                        }}
                        onEdit={handleEditTemplate}
                        onDelete={handleDeleteTemplate}
                    />
                )}
            </main>

            {showCreateStackModal && (
                <CreateStackModal
                    isDark={isDark}
                    newStackName={newStackName}
                    setNewStackName={setNewStackName}
                    newStackDescription={newStackDescription}
                    setNewStackDescription={setNewStackDescription}
                    newStackContent={newStackContent}
                    setNewStackContent={setNewStackContent}
                    newStackEnv={newStackEnv}
                    setNewStackEnv={setNewStackEnv}
                    composeError={newStackError}
                    onCreate={handleCreateStack}
                    onClose={() => setShowCreateStackModal(false)}
                />
            )}

            {showCreateTemplateModal && (
                <CreateTemplateModal
                    isDark={isDark}
                    newTemplateName={newTemplateName}
                    setNewTemplateName={setNewTemplateName}
                    newTemplateDescription={newTemplateDescription}
                    setNewTemplateDescription={setNewTemplateDescription}
                    newTemplateContent={newTemplateContent}
                    setNewTemplateContent={setNewTemplateContent}
                    newTemplateEnv={newTemplateEnv}
                    setNewTemplateEnv={setNewTemplateEnv}
                    composeError={newTemplateError}
                    onCreate={handleCreateTemplate}
                    onClose={() => setShowCreateTemplateModal(false)}
                />
            )}

            {showEditTemplateModal && (
                <EditTemplateModal
                    isDark={isDark}
                    editTemplateName={editTemplateName}
                    setEditTemplateName={setEditTemplateName}
                    editTemplateDescription={editTemplateDescription}
                    setEditTemplateDescription={setEditTemplateDescription}
                    editTemplateContent={editTemplateContent}
                    setEditTemplateContent={setEditTemplateContent}
                    editTemplateEnv={editTemplateEnv}
                    setEditTemplateEnv={setEditTemplateEnv}
                    composeError={editTemplateError}
                    onSave={handleSaveEditTemplate}
                    onClose={() => setShowEditTemplateModal(false)}
                />
            )}

            {showDeployModal && selectedTemplate && (
                <DeployModal
                    isDark={isDark}
                    template={selectedTemplate}
                    onDeploy={handleDeployFromTemplate}
                    onClose={() => setShowDeployModal(false)}
                />
            )}

            {showDeployStackModal && (
                <DeployStackModal
                    isOpen={showDeployStackModal}
                    onClose={() => setShowDeployStackModal(false)}
                    stackName={deployingStackName}
                    isNewStack={isNewStack}
                    pull={deployModal.pull}
                    onDeploySuccess={() => {
                        fetchStacks();
                        setActiveTab('stacks');
                        // 不自动关闭，让用户查看日志
                        // setTimeout(() => setShowDeployStackModal(false), 1500);
                    }}
                />
            )}

            {showAddComposeModal && (
                <AddComposeModal
                    isDark={isDark}
                    stackName={selectedExternalStack}
                    initialContent={initialComposeContent}
                    onSave={handleSaveConfig}
                    onClose={() => {
                        setShowAddComposeModal(false);
                        setSelectedExternalStack('');
                        setInitialComposeContent('');
                    }}
                />
            )}

            {rebuildModal.show && (
                <RebuildConfirmModal
                    isDark={isDark}
                    stackName={rebuildModal.stackName}
                    onClose={() => setRebuildModal({ show: false, stackName: '' })}
                    onConfirm={confirmRebuild}
                />
            )}

            {deleteStackModal.show && (
                <DeleteStackConfirmModal
                    isDark={isDark}
                    stackName={deleteStackModal.stackName}
                    onClose={() => setDeleteStackModal({ show: false, stackName: '' })}
                    onConfirm={confirmDeleteStack}
                />
            )}
        </div>
    );
}

function StacksGrid({ stacks, loading, isDark, onStart, onStop, onRestart, onRebuild, onDelete, onAddConfig, onEditConfig, getStatusColor, getStatusText, onSaveAsTemplate }) {
    const { t } = useTranslation();
    if (loading) {
        return null;
    }

    if (stacks.length === 0) {
        return (
            <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-12 border text-center`}>
                <Boxes className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('stacks.no_stacks')}</h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('stacks.no_stacks_desc')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {stacks.map((stack) => (
                <StackCard
                    key={stack.name}
                    stack={stack}
                    isDark={isDark}
                    onStart={onStart}
                    onStop={onStop}
                    onRestart={onRestart}
                    onRebuild={onRebuild}
                    onDelete={onDelete}
                    onAddConfig={onAddConfig}
                    onEditConfig={onEditConfig}
                    getStatusColor={getStatusColor}
                    getStatusText={getStatusText}
                    onSaveAsTemplate={onSaveAsTemplate}
                />
            ))}
        </div>
    );
}

function StackCard({ stack, isDark, onStart, onStop, onRestart, onRebuild, onDelete, onAddConfig, onEditConfig, getStatusColor, getStatusText, onSaveAsTemplate }) {
    const { t } = useTranslation();
    const isExternal = stack.managed === false;

    return (
        <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-4 border transition-all hover:shadow-md ${isExternal ? 'border-l-4 border-l-orange-500' : ''}`}>
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-50'} flex items-center justify-center`}>
                        <Boxes className={`w-6 h-6 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getStatusColor(stack.status)} border-2 ${isDark ? 'border-gray-900' : 'border-white'}`}></div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {stack.name}
                        </h3>
                        {isExternal && (
                            <div className="group relative">
                                <span className={`cursor-help px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-800'}`}>
                                    {t('stacks.external')}
                                </span>
                                <div className={`absolute left-0 bottom-full mb-2 w-48 p-2 rounded text-xs z-10 hidden group-hover:block ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-900 text-white'}`}>
                                    {t('stacks.external_tooltip')}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {getStatusText(stack.status)}
                            </span>
                        </div>
                    </div>

                    <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <span>{t('stacks.services')}: {stack.services}</span>
                        {stack.serviceNames && stack.serviceNames.length > 0 && (
                            <>
                                <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                                <div className="flex flex-wrap gap-1">
                                    {stack.serviceNames.slice(0, 3).map((service, idx) => (
                                        <span
                                            key={idx}
                                            className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}
                                        >
                                            {service}
                                        </span>
                                    ))}
                                    {stack.serviceNames.length > 3 && (
                                        <span className={`px-2 py-0.5 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            +{stack.serviceNames.length - 3}
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                        {(stack.path || stack.workingDir) && (
                            <>
                                <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                                <span className="truncate max-w-md text-xs font-mono opacity-70" title={stack.path || stack.workingDir}>
                                    {stack.path || stack.workingDir}
                                </span>
                            </>
                        )}

                    </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                    {isExternal ? (
                        // 外部堆栈：显示添加配置按钮
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onAddConfig(stack.name)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isDark
                                    ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                                    : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                    }`}
                                title={t('stacks.add_config_tooltip')}
                            >
                                <FilePlus className="w-4 h-4" />
                                <span className="text-sm font-medium">{t('stacks.take_over_stack')}</span>
                            </button>
                        </div>
                    ) : (
                        // 托管堆栈：显示管理按钮
                        <>
                            <button
                                onClick={() => onEditConfig(stack.name)}
                                className={`p-2.5 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-cyan-500/10 text-cyan-400 hover:text-cyan-300'
                                    : 'hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700'
                                    }`}
                                title={t('stacks.edit_config')}
                            >
                                <FileText className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => onRebuild(stack.name)}
                                className={`p-2.5 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-purple-500/10 text-purple-400 hover:text-purple-300'
                                    : 'hover:bg-purple-50 text-purple-600 hover:text-purple-700'
                                    }`}
                                title={t('stacks.rebuild')}
                            >
                                <Hammer className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => onStart(stack.name)}
                                className={`p-2.5 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-green-500/10 text-green-400 hover:text-green-300'
                                    : 'hover:bg-green-50 text-green-600 hover:text-green-700'
                                    }`}
                                title={t('stacks.start')}
                            >
                                <Play className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => onStop(stack.name)}
                                className={`p-2.5 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-yellow-500/10 text-yellow-400 hover:text-yellow-300'
                                    : 'hover:bg-yellow-50 text-yellow-600 hover:text-yellow-700'
                                    }`}
                                title={t('stacks.stop')}
                            >
                                <Square className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => onRestart(stack.name)}
                                className={`p-2.5 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-blue-500/10 text-blue-400 hover:text-blue-300'
                                    : 'hover:bg-blue-50 text-blue-600 hover:text-blue-700'
                                    }`}
                                title={t('stacks.restart')}
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => onDelete(stack.name)}
                                className={`p-2.5 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300'
                                    : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                                    }`}
                                title={t('stacks.delete')}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div >
        </div >
    );
}

function TemplatesGrid({ templates, isDark, onDeploy, onEdit, onDelete }) {
    const { t } = useTranslation();
    if (templates.length === 0) {
        return (
            <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-12 border text-center`}>
                <FileText className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('stacks.no_custom_templates')}</h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('stacks.create_template_guide')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {templates.map((template) => (
                <TemplateCard
                    key={template.name}
                    template={template}
                    isDark={isDark}
                    onDeploy={onDeploy}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}

function TemplateCard({ template, isDark, onDeploy, onEdit, onDelete }) {
    const { t } = useTranslation();
    return (
        <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-4 border transition-all hover:shadow-md`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} flex items-center justify-center`}>
                        <FileText className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {template.title || template.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-800'}`}>
                            {template.category}
                        </span>
                    </div>

                    <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span className="truncate">{template.description || t('stacks.no_description')}</span>
                        {template.tags && template.tags.length > 0 && (
                            <>
                                <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                                <div className="flex flex-wrap gap-1">
                                    {template.tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                    <button
                        onClick={() => onDeploy(template)}
                        className={`p-2.5 rounded-lg transition-colors ${isDark
                            ? 'hover:bg-cyan-500/10 text-cyan-400 hover:text-cyan-300'
                            : 'hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700'
                            }`}
                        title={t('stacks.deploy_template')}
                    >
                        <Play className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => onEdit(template)}
                        className={`p-2.5 rounded-lg transition-colors ${isDark
                            ? 'hover:bg-blue-500/10 text-blue-400 hover:text-blue-300'
                            : 'hover:bg-blue-50 text-blue-600 hover:text-blue-700'
                            }`}
                        title={t('stacks.edit_template')}
                    >
                        <Edit className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => onDelete(template.name)}
                        className={`p-2.5 rounded-lg transition-colors ${isDark
                            ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300'
                            : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                            }`}
                        title={t('stacks.delete_template')}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}



// Helper to extract variables from Compose content
function extractVariablesFromCompose(content) {
    if (!content) return [];
    const regex = /\$\{([A-Z0-9_]+)\}/g;
    const vars = new Set();
    let match;
    while ((match = regex.exec(content)) !== null) {
        vars.add(match[1]);
    }
    return Array.from(vars);
}


function CreateStackModal({ isDark, newStackName, setNewStackName, newStackDescription, setNewStackDescription, newStackContent, setNewStackContent, newStackEnv, setNewStackEnv, composeError, onCreate, onClose }) {
    const { t } = useTranslation();
    const hasError = Boolean(composeError);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-4xl border shadow-2xl p-6 h-[85vh] overflow-y-auto`}>
                <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('stacks.create_stack_title')}</h2>

                <div className="space-y-4">
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.stack_name')} *
                        </label>
                        <input
                            type="text"
                            value={newStackName}
                            onChange={(e) => setNewStackName(e.target.value)}
                            placeholder={t('stacks.stack_name_placeholder')}
                            className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.description_optional')}
                        </label>
                        <input
                            type="text"
                            value={newStackDescription}
                            onChange={(e) => setNewStackDescription(e.target.value)}
                            placeholder={t('stacks.stack_desc_placeholder')}
                            className={`w-full px-4 py-2 rounded-lg ${isDark ? 'bg-white/10 border border-white/20 text-white placeholder-gray-500' : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.compose_yaml')} *
                        </label>
                        <ComposeEditor
                            value={newStackContent}
                            onChange={(e) => setNewStackContent(e.target.value)}
                            error={composeError}
                            isDark={isDark}
                            placeholder={`version: '3.8'\nservices: \n  app: \n    image: nginx:latest`}
                            rows={15}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.env_config')}
                        </label>
                        <EnvironmentVariables
                            value={newStackEnv}
                            onChange={setNewStackEnv}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onCreate}
                        disabled={!newStackName || !newStackContent || hasError}
                        className={`px-4 py-2 rounded-lg transition-all ${!newStackName || !newStackContent || hasError
                            ? 'bg-gray-400 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
                            }`}
                    >
                        {t('stacks.create_stack')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function CreateTemplateModal({ isDark, newTemplateName, setNewTemplateName, newTemplateDescription, setNewTemplateDescription, newTemplateContent, setNewTemplateContent, composeError, onCreate, onClose }) {
    const { t } = useTranslation();
    const hasError = Boolean(composeError);
    const hasContent = newTemplateContent && newTemplateContent.trim() !== '';

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-4xl border shadow-2xl p-6 h-[85vh] overflow-y-auto`}>
                <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('stacks.create_template_title')}</h2>

                <div className="space-y-4">
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.template_name')} *
                        </label>
                        <input
                            type="text"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            placeholder={t('stacks.template_name_placeholder')}
                            className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.description_optional')}
                        </label>
                        <input
                            type="text"
                            value={newTemplateDescription}
                            onChange={(e) => setNewTemplateDescription(e.target.value)}
                            placeholder={t('stacks.template_desc_placeholder')}
                            className={`w-full px-4 py-2 rounded-lg ${isDark ? 'bg-white/10 border border-white/20 text-white placeholder-gray-500' : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.compose_yaml')} *
                        </label>
                        <ComposeEditor
                            value={newTemplateContent}
                            onChange={(e) => setNewTemplateContent(e.target.value)}
                            error={composeError}
                            isDark={isDark}
                            placeholder={`version: '3.8'\nservices: \n  app: \n    image: nginx:latest`}
                            rows={17}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onCreate}
                        disabled={!newTemplateName || !newTemplateContent || hasError}
                        className={`px-4 py-2 rounded-lg transition-all ${!newTemplateName || !newTemplateContent || hasError
                            ? 'bg-gray-400 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
                            }`}
                    >
                        {t('stacks.save_template')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditTemplateModal({ isDark, editTemplateName, setEditTemplateName, editTemplateDescription, setEditTemplateDescription, editTemplateContent, setEditTemplateContent, composeError, onSave, onClose }) {
    const { t } = useTranslation();
    const hasError = Boolean(composeError);
    const hasContent = editTemplateContent && editTemplateContent.trim() !== '';

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-4xl border shadow-2xl p-6 h-[85vh] overflow-y-auto`}>
                <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('stacks.edit_template_title')}</h2>

                <div className="space-y-4">
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.template_name')}
                        </label>
                        <input
                            type="text"
                            value={editTemplateName}
                            onChange={(e) => setEditTemplateName(e.target.value)}
                            className={`w-full px-4 py-2 rounded-lg ${isDark
                                ? 'bg-white/10 border border-white/20 text-white placeholder-gray-500'
                                : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400'
                                } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                            placeholder={t('stacks.input_template_name')}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.description')}
                        </label>
                        <input
                            type="text"
                            value={editTemplateDescription}
                            onChange={(e) => setEditTemplateDescription(e.target.value)}
                            className={`w-full px-4 py-2 rounded-lg ${isDark
                                ? 'bg-white/10 border border-white/20 text-white placeholder-gray-500'
                                : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400'
                                } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                            placeholder={t('stacks.input_template_desc')}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.compose_content')}
                        </label>
                        <ComposeEditor
                            value={editTemplateContent}
                            onChange={(e) => setEditTemplateContent(e.target.value)}
                            error={composeError}
                            isDark={isDark}
                            placeholder={`version: '3'\nservices:\n  web:\n    image: nginx:latest\n    ports:\n      - 80:80`}
                            rows={17}
                        />
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg transition-colors ${isDark ? 'glass glass-hover text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!editTemplateContent || hasError}
                        className={`px-4 py-2 rounded-lg transition-all ${!editTemplateContent || hasError
                            ? 'bg-gray-400 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
                            }`}
                    >
                        {t('stacks.save')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function DeployModal({ isDark, template, onDeploy, onClose }) {
    const { t } = useTranslation();
    const [stackName, setStackName] = useState('');
    // 初始化环境变量：自动从 Compose 内容中解析
    const [env, setEnv] = useState(() => {
        const extracted = extractVariablesFromCompose(template.composeContent);
        // 如果模板本身有预设变量，优先使用预设值
        const presetEnvMap = new Map((template.env || []).map(e => [e.name, e]));

        return extracted.map(varName => {
            const preset = presetEnvMap.get(varName);
            return {
                name: varName,
                value: preset ? (preset.default || preset.value || '') : '',
                label: preset ? (preset.label || '') : ''
            };
        });
    });

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-4xl border shadow-2xl p-6 max-h-[90vh] overflow-y-auto`}>
                <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('stacks.deploy_from_template_title', { title: template.title })}
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.new_stack_name')} *
                        </label>
                        <input
                            type="text"
                            value={stackName}
                            onChange={(e) => setStackName(e.target.value)}
                            placeholder={t('stacks.new_stack_name_placeholder')}
                            className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                        />
                    </div>

                    <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Trans i18nKey="stacks.deploy_template_desc" values={{ title: template.title }} components={{ 1: <span className="font-medium" /> }} />
                        </p>
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.template_preview')}
                        </label>
                        <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                            <ComposeEditor
                                value={template.composeContent || ''}
                                onChange={() => { }} // Read-only
                                isDark={isDark}
                                rows={15}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.env_config')}
                        </label>
                        {env.length > 0 ? (
                            <EnvironmentVariables
                                value={env}
                                onChange={setEnv}
                            />
                        ) : (
                            <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'} italic`}>
                                {t('stacks.no_env_needed')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => onDeploy(stackName, env)}
                        disabled={!stackName}
                        className={`px-4 py-2 rounded-lg transition-all ${!stackName
                            ? 'bg-gray-400 cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
                            }`}
                    >
                        {t('stacks.deploy')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function NavItem({ icon, label, active, onClick, isDark }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active
                ? isDark
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-cyan-50 text-cyan-600'
                : isDark
                    ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
        >
            {icon}
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}

function RebuildConfirmModal({ isDark, stackName, onClose, onConfirm }) {
    const { t } = useTranslation();
    const [alwaysPull, setAlwaysPull] = useState(false);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-md border shadow-2xl p-6`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'} flex items-center justify-center`}>
                        <Hammer className="w-5 h-5" />
                    </div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('stacks.rebuild_stack_title')}
                    </h2>
                </div>

                <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <Trans i18nKey="stacks.rebuild_confirm_desc" values={{ name: stackName }} components={{ 1: <span className="font-bold" /> }} />
                </p>

                <div className="mb-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={alwaysPull}
                            onChange={(e) => setAlwaysPull(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('stacks.always_pull_image')}
                        </span>
                    </label>
                    <p className={`text-xs mt-1 ml-6 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {t('stacks.always_pull_desc')}
                    </p>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => onConfirm(alwaysPull)}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                    >
                        {t('stacks.confirm_rebuild')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function DeleteStackConfirmModal({ isDark, stackName, onClose, onConfirm }) {
    const { t } = useTranslation();
    const [deleteImage, setDeleteImage] = useState(false);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-md border shadow-2xl p-6`}>
                <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('stacks.delete_stack_title')}
                </h3>
                <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    <Trans i18nKey="stacks.delete_stack_confirm_desc" values={{ name: stackName }} components={{ 1: <span className="font-mono font-bold" /> }} />
                </p>

                <label className={`flex items-center gap-3 p-3 rounded-lg border mb-6 cursor-pointer ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                        type="checkbox"
                        checked={deleteImage}
                        onChange={(e) => setDeleteImage(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                    />
                    <div className="flex-1">
                        <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                            {t('stacks.delete_with_images')}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('stacks.delete_images_warn')}
                        </div>
                    </div>
                </label>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => onConfirm(deleteImage)}
                        className="px-4 py-2 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
                    >
                        {t('stacks.confirm_delete')}
                    </button>
                </div>
            </div>
        </div>
    );
}

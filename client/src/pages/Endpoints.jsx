import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    Trash2,
    CheckCircle,
    XCircle,
    MoreVertical,
    Edit2
} from 'lucide-react';
import axios from 'axios';
import { useThemeStore } from '../store/themeStore';
import { useEndpoint } from '../context/EndpointContext';
import EndpointSelector from '../components/EndpointSelector';
import { APP_VERSION } from '../constants';

export default function Endpoints() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useThemeStore();
    const [endpoints, setEndpoints] = useState([]);
    const [actionMenuId, setActionMenuId] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingEndpoint, setEditingEndpoint] = useState(null);
    const [newEndpoint, setNewEndpoint] = useState({
        name: '',
        type: 'agent',
        host: '',
        port: '',
        secret: ''
    });
    const { refreshEndpoints: globalRefreshEndpoints, currentEndpoint } = useEndpoint();

    const fetchEndpoints = async () => {
        try {
            // 1. 先获取列表（快速）
            const response = await axios.get('/api/endpoints');
            // 初始化状态为 checking
            const initialEndpoints = response.data.map(ep => ({ ...ep, status: 'checking' }));
            setEndpoints(initialEndpoints);

            // 2. 异步获取状态
            try {
                const statusResponse = await axios.get('/api/endpoints/status');
                const statuses = statusResponse.data; // [{id, status}, ...]

                setEndpoints(prev => prev.map(ep => {
                    const statusObj = statuses.find(s => s.id === ep.id);
                    return statusObj ? { ...ep, status: statusObj.status } : ep;
                }));
            } catch (statusError) {
                console.error('Failed to fetch endpoint statuses:', statusError);
            }
        } catch (error) {
            console.error('Failed to fetch endpoints:', error);
        }
    };

    useEffect(() => {
        fetchEndpoints();
    }, []);

    const handleAdd = async () => {
        try {
            if (!newEndpoint.name) {
                alert(t('endpoint.name_required_alert'));
                return;
            }
            if (newEndpoint.type === 'agent' && (!newEndpoint.host || !newEndpoint.secret)) {
                alert(t('endpoint.agent_required_alert'));
                return;
            }

            let endpointData = { ...newEndpoint };
            // 确保端口有默认值
            if (!endpointData.port) {
                endpointData.port = '9002';
            }

            await axios.post('/api/endpoints', endpointData);
            setShowAddModal(false);
            setNewEndpoint({
                name: '',
                type: 'agent',
                host: '',
                port: '',
                secret: ''
            });
            fetchEndpoints();
            globalRefreshEndpoints();
        } catch (error) {
            console.error('Failed to add endpoint:', error);
            alert(t('endpoint.add_fail_alert') + (error.response?.data?.error || error.message));
        }
    };

    const handleUpdate = async () => {
        if (!editingEndpoint) return;
        try {
            await axios.put(`/api/endpoints/${editingEndpoint.id}`, editingEndpoint);
            setShowEditModal(false);
            setEditingEndpoint(null);
            fetchEndpoints();
            globalRefreshEndpoints();
        } catch (error) {
            console.error('Failed to update endpoint:', error);
            alert(t('endpoint.update_fail_alert'));
        }
    };

    const handleRemove = async (endpoint) => {
        if (!confirm(t('endpoint.delete_confirm', { name: endpoint.name }))) return;

        try {
            await axios.delete(`/api/endpoints/${endpoint.id}`);
            fetchEndpoints();
            globalRefreshEndpoints();
            setActionMenuId(null);
        } catch (error) {
            console.error('Failed to remove endpoint:', error);
            alert(t('endpoint.remove_fail_alert'));
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
    };

    const isDark = theme === 'dark';

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
                    <NavItem icon={<Boxes />} label={t('nav.stacks')} onClick={() => navigate('/stacks')} isDark={isDark} />
                    <NavItem icon={<Image />} label={t('nav.images')} onClick={() => navigate('/images')} isDark={isDark} />
                    <NavItem icon={<HardDrive />} label={t('nav.volumes')} onClick={() => navigate('/volumes')} isDark={isDark} />
                    <NavItem icon={<Network />} label={t('nav.networks')} onClick={() => navigate('/networks')} isDark={isDark} />
                    <NavItem icon={<Server />} label={t('nav.endpoints')} active isDark={isDark} />
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
                            {t('nav.endpoints')}
                        </h1>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('endpoint.total_count', { count: endpoints.length })}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${isDark
                                ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                                }`}
                        >
                            <Plus className="w-5 h-5" />
                            <span>{t('endpoint.add_button')}</span>
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

                {/* Endpoints列表 */}
                <div className="space-y-4">
                    {endpoints.map((endpoint) => (
                        <div
                            key={endpoint.id}
                            className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl border p-4 flex items-center justify-between transition-all hover:shadow-md`}
                        >
                            <div className="flex items-center gap-4">
                                {/* 图标 */}
                                <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} flex items-center justify-center flex-shrink-0`}>
                                    <Server className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                </div>

                                {/* 信息 */}
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {endpoint.name}
                                        </h3>
                                        {endpoint.id === 'local' && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                                {t('endpoint.local_badge')}
                                            </span>
                                        )}
                                        {endpoint.id === currentEndpoint && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                                                {t('endpoint.current_badge')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Globe className="w-3 h-3" />
                                            {endpoint.type === 'local' ? t('endpoint.local_service') : `${endpoint.host}:${endpoint.port}`}
                                        </span>
                                        <span className={`flex items-center gap-1 ${endpoint.status === 'online' ? 'text-green-500' : endpoint.status === 'checking' ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {endpoint.status === 'online' ? (
                                                <>
                                                    <CheckCircle className="w-3 h-3" />
                                                    {t('endpoint.status_connected')}
                                                </>
                                            ) : endpoint.status === 'checking' ? (
                                                <>
                                                    <div className="w-3 h-3 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
                                                    {t('endpoint.status_checking')}
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="w-3 h-3" />
                                                    {t('endpoint.status_disconnected')}
                                                </>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 操作 */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setEditingEndpoint(endpoint);
                                        setShowEditModal(true);
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                {endpoint.id !== 'local' && (
                                    <button
                                        onClick={() => handleRemove(endpoint)}
                                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-50 text-gray-500 hover:text-red-600'}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* 添加节点模态框 */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'glass border border-white/10' : 'bg-white shadow-xl'}`}>
                        <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('endpoint.add_modal_title')}</h2>

                        <div className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('endpoint.name_label')}
                                </label>
                                <input
                                    type="text"
                                    value={newEndpoint.name}
                                    onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
                                    className={`w-full px-4 py-2 rounded-lg outline-none transition-all ${isDark
                                        ? 'bg-black/20 border border-white/10 text-white focus:border-cyan-500'
                                        : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                                        }`}
                                    placeholder={t('endpoint.name_placeholder')}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('endpoint.host_label')}
                                    </label>
                                    <input
                                        type="text"
                                        value={newEndpoint.host}
                                        onChange={(e) => setNewEndpoint({ ...newEndpoint, host: e.target.value })}
                                        className={`w-full px-4 py-2 rounded-lg outline-none transition-all ${isDark
                                            ? 'bg-black/20 border border-white/10 text-white focus:border-cyan-500'
                                            : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                                            }`}
                                        placeholder="192.168.1.100"
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('endpoint.port_label')}
                                    </label>
                                    <input
                                        type="text"
                                        value={newEndpoint.port}
                                        onChange={(e) => setNewEndpoint({ ...newEndpoint, port: e.target.value })}
                                        className={`w-full px-4 py-2 rounded-lg outline-none transition-all ${isDark
                                            ? 'bg-black/20 border border-white/10 text-white focus:border-cyan-500'
                                            : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                                            }`}
                                        placeholder="9002"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('endpoint.secret_label')}
                                </label>
                                <input
                                    type="password"
                                    value={newEndpoint.secret}
                                    onChange={(e) => setNewEndpoint({ ...newEndpoint, secret: e.target.value })}
                                    className={`w-full px-4 py-2 rounded-lg outline-none transition-all ${isDark
                                        ? 'bg-black/20 border border-white/10 text-white focus:border-cyan-500'
                                        : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                                        }`}
                                    placeholder={t('endpoint.secret_hint_placeholder')}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleAdd}
                                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600"
                            >
                                {t('common.create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 编辑节点模态框 */}
            {showEditModal && editingEndpoint && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'glass border border-white/10' : 'bg-white shadow-xl'}`}>
                        <h2 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('endpoint.edit_modal_title')}</h2>

                        <div className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('endpoint.name_label')}
                                </label>
                                <input
                                    type="text"
                                    value={editingEndpoint.name}
                                    onChange={(e) => setEditingEndpoint({ ...editingEndpoint, name: e.target.value })}
                                    className={`w-full px-4 py-2 rounded-lg outline-none transition-all ${isDark
                                        ? 'bg-black/20 border border-white/10 text-white focus:border-cyan-500'
                                        : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                                        }`}
                                />
                            </div>

                            {editingEndpoint.id === 'local' && (
                                <div>
                                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('endpoint.host_ip_label')}
                                    </label>
                                    <input
                                        type="text"
                                        value={editingEndpoint.host || ''}
                                        onChange={(e) => setEditingEndpoint({ ...editingEndpoint, host: e.target.value })}
                                        className={`w-full px-4 py-2 rounded-lg outline-none transition-all ${isDark
                                            ? 'bg-black/20 border border-white/10 text-white focus:border-cyan-500'
                                            : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                                            }`}
                                        placeholder="例如: 192.168.1.100"
                                    />
                                    <p className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {t('endpoint.host_ip_hint')}
                                    </p>
                                </div>
                            )}

                            {editingEndpoint.id !== 'local' && (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2">
                                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {t('endpoint.host_label')}
                                            </label>
                                            <input
                                                type="text"
                                                value={editingEndpoint.host}
                                                onChange={(e) => setEditingEndpoint({ ...editingEndpoint, host: e.target.value })}
                                                className={`w-full px-4 py-2 rounded-lg outline-none transition-all ${isDark
                                                    ? 'bg-black/20 border border-white/10 text-white focus:border-cyan-500'
                                                    : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                                                    }`}
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {t('endpoint.port_label')}
                                            </label>
                                            <input
                                                type="text"
                                                value={editingEndpoint.port}
                                                onChange={(e) => setEditingEndpoint({ ...editingEndpoint, port: e.target.value })}
                                                className={`w-full px-4 py-2 rounded-lg outline-none transition-all ${isDark
                                                    ? 'bg-black/20 border border-white/10 text-white focus:border-cyan-500'
                                                    : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                                                    }`}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {t('endpoint.secret_label')}
                                        </label>
                                        <input
                                            type="password"
                                            value={editingEndpoint.secret || ''}
                                            onChange={(e) => setEditingEndpoint({ ...editingEndpoint, secret: e.target.value })}
                                            className={`w-full px-4 py-2 rounded-lg outline-none transition-all ${isDark
                                                ? 'bg-black/20 border border-white/10 text-white focus:border-cyan-500'
                                                : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-cyan-500'
                                                }`}
                                            placeholder={t('endpoint.secret_placeholder')}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingEndpoint(null);
                                }}
                                className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleUpdate}
                                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600"
                            >
                                {t('common.update')}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
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

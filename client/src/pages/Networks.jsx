import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    Container,
    Image,
    Boxes,
    HardDrive,
    Network as NetworkIcon,
    Server,
    LogOut,
    Sun,
    Moon,
    Globe,
    Trash2,
    MoreVertical,
    Plus,
    X
} from 'lucide-react';
import axios from 'axios';
import { useThemeStore } from '../store/themeStore';
import { useEndpoint } from '../context/EndpointContext';
import EndpointSelector from '../components/EndpointSelector';

import { APP_VERSION } from '../constants';

export default function Networks() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useThemeStore();
    const [networks, setNetworks] = useState([]);
    const [actionMenuId, setActionMenuId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { refreshEndpoints, currentEndpoint } = useEndpoint();

    useEffect(() => {
        refreshEndpoints();
    }, []);

    useEffect(() => {
        setNetworks([]); // Clear previous data
        fetchNetworks();
    }, [currentEndpoint]);

    const fetchNetworks = async () => {
        try {
            const response = await axios.get('/api/networks');
            const networksData = response.data || [];
            // 默认按名称排序
            networksData.sort((a, b) => a.Name.localeCompare(b.Name));
            setNetworks(networksData);
        } catch (error) {
            console.error('Failed to fetch networks:', error);
        }
    };

    const handleRemove = async (network) => {
        if (!confirm(`确定要删除网络 ${network.Name} 吗？`)) return;

        try {
            await axios.delete(`/api/networks/${network.Id}`);
            fetchNetworks();
            setActionMenuId(null);
        } catch (error) {
            console.error('Failed to remove network:', error);
            alert(`删除失败: ${error.message}`);
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

    return (
        <div className={isDark ? 'min-h-screen bg-gray-950' : 'min-h-screen bg-gray-50'}>
            <aside className={`fixed left-0 top-0 h-full w-72 ${isDark ? 'glass border-r border-white/10' : 'bg-white border-r border-gray-200 shadow-sm'} p-4`}>
                <div className="mb-8 pb-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 flex-shrink-0">
                            <img src="/logo.png" alt="DMA Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className={`text-base font-bold leading-tight mb-1 ${isDark ? 'bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent' : 'text-gray-900'}`}>
                                Docker Manager
                            </h1>
                            <div className="flex items-center justify-between">
                                <p className={`text-sm leading-tight whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    容器化应用管理平台
                                </p>
                                <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{APP_VERSION}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <nav className="space-y-2">
                    <NavItem icon={<LayoutDashboard />} label={t('nav.dashboard')} onClick={() => navigate('/')} isDark={isDark} />
                    <NavItem icon={<Container />} label={t('nav.containers')} onClick={() => navigate('/containers')} isDark={isDark} />
                    <NavItem icon={<Boxes />} label={t('nav.stacks')} onClick={() => navigate('/stacks')} isDark={isDark} />
                    <NavItem icon={<Image />} label={t('nav.images')} onClick={() => navigate('/images')} isDark={isDark} />
                    <NavItem icon={<HardDrive />} label={t('nav.volumes')} onClick={() => navigate('/volumes')} isDark={isDark} />
                    <NavItem icon={<NetworkIcon />} label={t('nav.networks')} active isDark={isDark} />
                    <NavItem icon={<Server />} label={t('nav.endpoints')} onClick={() => navigate('/endpoints')} isDark={isDark} />
                </nav>

                <div className="absolute bottom-4 left-4 right-4 space-y-3">
                    <EndpointSelector isDark={isDark} popupDirection="up" />
                    <button
                        onClick={handleLogout}
                        className={`w-full ${isDark ? 'glass glass-hover' : 'bg-red-50 hover:bg-red-100'} p-3 rounded-lg flex items-center gap-2 text-red-400 transition-colors`}
                    >
                        <LogOut className="w-5 h-5" />
                        退出
                    </button>
                </div>
            </aside >

            <main className="ml-72 p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('nav.networks')}
                        </h1>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            共 {networks.length} 个网络
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${isDark
                                ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                                }`}
                        >
                            <Plus className="w-5 h-5" />
                            <span>创建网络</span>
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

                <div className="space-y-4">
                    {networks.length === 0 ? (
                        <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-12 border text-center`}>
                            <NetworkIcon className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>没有网络</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                当前环境没有创建任何 Docker 网络。点击右上角"创建网络"开始。
                            </p>
                        </div>
                    ) : (
                        networks.map((network) => (
                            <NetworkCard
                                key={network.Id}
                                network={network}
                                isDark={isDark}
                                actionMenuId={actionMenuId}
                                setActionMenuId={setActionMenuId}
                                handleRemove={handleRemove}
                            />
                        ))
                    )}
                </div>
            </main>

            <CreateNetworkModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                isDark={isDark}
                onCreated={fetchNetworks}
            />
        </div >
    );
}

function NetworkCard({ network, isDark, actionMenuId, setActionMenuId, handleRemove }) {
    const showMenu = actionMenuId === network.Id;
    const created = new Date(network.Created).toLocaleDateString('zh-CN');
    const isSystemNetwork = ['bridge', 'host', 'none'].includes(network.Name);

    // 提取IP信息
    const ipv4Config = network.IPAM?.Config?.find(c => c.Subnet && !c.Subnet.includes(':'));
    const ipv6Config = network.IPAM?.Config?.find(c => c.Subnet && c.Subnet.includes(':'));
    const ipv4 = ipv4Config ? ipv4Config.Subnet : '-';
    const ipv6 = ipv6Config ? ipv6Config.Subnet : '-';

    return (
        <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-4 border transition-all hover:shadow-md`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-teal-500/20' : 'bg-teal-50'} flex items-center justify-center flex-shrink-0`}>
                        <NetworkIcon className={`w-6 h-6 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {network.Name}
                            </h3>
                            {isSystemNetwork && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
                                    系统
                                </span>
                            )}
                        </div>
                        <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <span className="font-mono">驱动: {network.Driver}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span>作用域: {network.Scope}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span className="font-mono">IPv4: {ipv4}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span className="font-mono">IPv6: {ipv6}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span>创建时间: {created}</span>
                        </div>
                    </div>

                    {!isSystemNetwork && (!network.Containers || Object.keys(network.Containers).length === 0) && (
                        <div className="relative ml-4">
                            <button
                                onClick={() => handleRemove(network)}
                                className={`p-2.5 rounded-lg ${isDark
                                    ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300'
                                    : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                                    } transition-colors`}
                                title="删除网络"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function CreateNetworkModal({ isOpen, onClose, isDark, onCreated }) {
    const [formData, setFormData] = useState({
        Name: '',
        Driver: 'bridge',
        EnableIPv4: false,
        IPv4Subnet: '',
        IPv4Gateway: '',
        EnableIPv6: false,
        IPv6Subnet: '',
        IPv6Gateway: '',
        Internal: false,
        Attachable: false,
        Ingress: false,
        Options: [] // Array of { key, value }
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                Name: formData.Name,
                Driver: formData.Driver,
                Internal: formData.Internal,
                Attachable: formData.Attachable,
                Ingress: formData.Ingress,
                EnableIPv6: formData.EnableIPv6,
                Options: formData.Options.reduce((acc, curr) => {
                    if (curr.key && curr.value) acc[curr.key] = curr.value;
                    return acc;
                }, {}),
                IPAM: {
                    Config: []
                }
            };

            if (formData.EnableIPv4 && formData.IPv4Subnet) {
                payload.IPAM.Config.push({
                    Subnet: formData.IPv4Subnet,
                    Gateway: formData.IPv4Gateway || undefined
                });
            }

            if (formData.EnableIPv6 && formData.IPv6Subnet) {
                payload.IPAM.Config.push({
                    Subnet: formData.IPv6Subnet,
                    Gateway: formData.IPv6Gateway || undefined
                });
            }

            await axios.post('/api/networks', payload);
            onCreated();
            onClose();
        } catch (error) {
            console.error('Failed to create network:', error);
            alert(`创建失败: ${error.response?.data?.error || error.message}`);
        }
    };

    const addOption = () => {
        setFormData({ ...formData, Options: [...formData.Options, { key: '', value: '' }] });
    };

    const updateOption = (index, field, value) => {
        const newOptions = [...formData.Options];
        newOptions[index][field] = value;
        setFormData({ ...formData, Options: newOptions });
    };

    const removeOption = (index) => {
        const newOptions = formData.Options.filter((_, i) => i !== index);
        setFormData({ ...formData, Options: newOptions });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-2xl border shadow-2xl max-h-[90vh] overflow-y-auto`}>
                <div className={`p-6 border-b ${isDark ? 'border-white/10' : 'border-gray-100'} flex items-center justify-between sticky top-0 ${isDark ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur z-10`}>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        创建网络
                    </h2>
                    <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* 名称 */}
                    <div className="space-y-2">
                        <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <span className="text-red-500 mr-1">*</span>名称
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.Name}
                            onChange={e => setFormData({ ...formData, Name: e.target.value })}
                            placeholder="指定唯一的网络名称"
                            className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-black/20 border-white/10 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-blue-500/50 outline-none transition-all`}
                        />
                    </div>

                    {/* 驱动 */}
                    <div className="space-y-2">
                        <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            驱动
                        </label>
                        <select
                            value={formData.Driver}
                            onChange={e => setFormData({ ...formData, Driver: e.target.value })}
                            className={`w-full px-4 py-2.5 rounded-lg border ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-2 focus:ring-blue-500/50 outline-none transition-all`}
                        >
                            <option value="bridge">bridge</option>
                            <option value="host">host</option>
                            <option value="overlay">overlay</option>
                            <option value="macvlan">macvlan</option>
                            <option value="null">null</option>
                        </select>
                    </div>

                    {/* 开关选项组 */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <ToggleField
                            label="自定IPv4子网"
                            checked={formData.EnableIPv4}
                            onChange={checked => setFormData({ ...formData, EnableIPv4: checked })}
                            isDark={isDark}
                        />
                        <ToggleField
                            label="隔离外部访问"
                            checked={formData.Internal}
                            onChange={checked => setFormData({ ...formData, Internal: checked })}
                            isDark={isDark}
                        />
                        <ToggleField
                            label="允许手动附加容器"
                            checked={formData.Attachable}
                            onChange={checked => setFormData({ ...formData, Attachable: checked })}
                            isDark={isDark}
                        />
                        <ToggleField
                            label="启用IPv6"
                            checked={formData.EnableIPv6}
                            onChange={checked => setFormData({ ...formData, EnableIPv6: checked })}
                            isDark={isDark}
                        />
                    </div>

                    {/* IPv4 配置 */}
                    {formData.EnableIPv4 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                            <div className="space-y-2">
                                <label className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>IPv4 子网 (CIDR)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 172.20.0.0/16"
                                    value={formData.IPv4Subnet}
                                    onChange={e => setFormData({ ...formData, IPv4Subnet: e.target.value })}
                                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>IPv4 网关 (可选)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 172.20.0.1"
                                    value={formData.IPv4Gateway}
                                    onChange={e => setFormData({ ...formData, IPv4Gateway: e.target.value })}
                                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                                />
                            </div>
                        </div>
                    )}

                    {/* IPv6 配置 */}
                    {formData.EnableIPv6 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                            <div className="space-y-2">
                                <label className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>IPv6 子网 (CIDR)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 2001:db8::/64"
                                    value={formData.IPv6Subnet}
                                    onChange={e => setFormData({ ...formData, IPv6Subnet: e.target.value })}
                                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>IPv6 网关 (可选)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 2001:db8::1"
                                    value={formData.IPv6Gateway}
                                    onChange={e => setFormData({ ...formData, IPv6Gateway: e.target.value })}
                                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                                />
                            </div>
                        </div>
                    )}

                    {/* 自定义驱动配置 */}
                    <div className="space-y-3">
                        <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            自定义驱动配置
                        </label>
                        <div className="space-y-2">
                            {formData.Options.map((opt, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Key"
                                        value={opt.key}
                                        onChange={e => updateOption(idx, 'key', e.target.value)}
                                        className={`flex-1 px-3 py-2 rounded border ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Value"
                                        value={opt.value}
                                        onChange={e => updateOption(idx, 'value', e.target.value)}
                                        className={`flex-1 px-3 py-2 rounded border ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeOption(idx)}
                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addOption}
                                className={`w-full py-2 border border-dashed rounded-lg text-sm transition-colors ${isDark ? 'border-white/20 text-gray-400 hover:border-white/40 hover:text-white' : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}
                            >
                                + 添加一行数据
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                        >
                            确定
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ToggleField({ label, checked, onChange, isDark, disabled }) {
    return (
        <div className="flex flex-col gap-2">
            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</span>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className={`w-12 h-6 rounded-full transition-colors relative ${checked ? 'bg-blue-500' : (isDark ? 'bg-gray-700' : 'bg-gray-300')} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
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

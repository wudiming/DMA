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
            const networksData = Array.isArray(response.data) ? response.data : [];
            // 默认按名称排序
            networksData.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
            setNetworks(networksData);
        } catch (error) {
            console.error('Failed to fetch networks:', error);
        }
    };

    const handleRemove = async (network) => {
        if (!confirm(t('network.delete_confirm', { name: network.Name }))) return;

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
                        {t('auth.logout')}
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
                            {t('dashboard.total')} {networks.length} {t('dashboard.network_count')}
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
                            <span>{t('network.create')}</span>
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
                            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('network.no_networks')}</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('network.no_networks_desc')}
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
    const { t } = useTranslation();
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
                                    {t('common.system')}
                                </span>
                            )}
                        </div>
                        <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <span className="font-mono">{t('network.driver')}: {network.Driver}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span>{t('network.scope')}: {network.Scope}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span className="font-mono">IPv4: {ipv4}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span className="font-mono">IPv6: {ipv6}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span>{t('common.created')}: {created}</span>
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
                                title={t('common.delete')}
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


// ── 各驱动支持的能力矩阵 ─────────────────────────────────────────────────────
const DRIVER_CAPS = {
    bridge:  { ipam: true,  internal: true,  ipv6: true,  attachable: false, parent: false },
    macvlan: { ipam: true,  internal: true,  ipv6: true,  attachable: false, parent: true,  parentRequired: true  },
    ipvlan:  { ipam: true,  internal: true,  ipv6: false, attachable: false, parent: true,  parentRequired: true  },
    overlay: { ipam: true,  internal: true,  ipv6: true,  attachable: true,  parent: false },
    host:    { ipam: false, internal: false, ipv6: false, attachable: false, parent: false },
    null:    { ipam: false, internal: false, ipv6: false, attachable: false, parent: false },
};

// macvlan 子模式
const MACVLAN_MODES = [
    { value: '',          label: 'bridge（默认，推荐）' },
    { value: 'private',   label: 'private（隔离，容器间不通）' },
    { value: 'vepa',      label: 'vepa（需交换机支持）' },
    { value: 'passthru',  label: 'passthru（独占物理网卡）' },
];

// ipvlan 子模式
const IPVLAN_MODES = [
    { value: '',    label: 'l2（默认，二层）' },
    { value: 'l3',  label: 'l3（三层路由）' },
    { value: 'l3s', label: 'l3s（三层对称路由）' },
];

function CreateNetworkModal({ isOpen, onClose, isDark, onCreated }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        Name: '',
        Driver: 'bridge',
        // IPAM
        EnableIPv4: false,
        IPv4Subnet: '',
        IPv4Gateway: '',
        EnableIPv6: false,
        IPv6Subnet: '',
        IPv6Gateway: '',
        // 标志
        Internal: false,
        Attachable: false,
        // macvlan / ipvlan 专属
        Parent: '',     // 物理网卡，如 eth0、eno1
        VlanMode: '',   // macvlan: bridge/private/vepa/passthru; ipvlan: l2/l3/l3s
        // 自定义驱动参数（KV 对）
        Options: []
    });
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const caps = DRIVER_CAPS[formData.Driver] || DRIVER_CAPS.bridge;
    const isSimpleDriver = formData.Driver === 'host' || formData.Driver === 'null';

    const set = (patch) => setFormData(prev => ({ ...prev, ...patch }));

    // 切换驱动时重置驱动专属字段，但保留名称
    const handleDriverChange = (driver) => {
        setFormData(prev => ({
            ...prev,
            Driver: driver,
            // 重置驱动专属
            EnableIPv4: false, IPv4Subnet: '', IPv4Gateway: '',
            EnableIPv6: false, IPv6Subnet: '', IPv6Gateway: '',
            Internal: false, Attachable: false,
            Parent: '', VlanMode: '',
            Options: []
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (caps.parent && caps.parentRequired && !formData.Parent.trim()) {
            alert('请填写物理网卡名称（Parent Interface），macvlan/ipvlan 必须指定');
            return;
        }
        setSubmitting(true);
        try {
            // 构建 Options 对象
            const driverOptions = {};
            if (caps.parent && formData.Parent.trim()) {
                driverOptions['parent'] = formData.Parent.trim();
            }
            if (formData.VlanMode) {
                driverOptions['mode'] = formData.VlanMode;
            }
            // 合并用户自定义 KV
            formData.Options.forEach(({ key, value }) => {
                if (key && value) driverOptions[key] = value;
            });

            const payload = {
                Name: formData.Name,
                Driver: formData.Driver,
                Internal: caps.internal ? formData.Internal : undefined,
                Attachable: caps.attachable ? formData.Attachable : undefined,
                EnableIPv6: caps.ipv6 ? formData.EnableIPv6 : undefined,
                Options: Object.keys(driverOptions).length > 0 ? driverOptions : undefined,
                IPAM: { Config: [] }
            };

            if (caps.ipam && formData.EnableIPv4 && formData.IPv4Subnet.trim()) {
                payload.IPAM.Config.push({
                    Subnet: formData.IPv4Subnet.trim(),
                    Gateway: formData.IPv4Gateway.trim() || undefined
                });
            }
            if (caps.ipv6 && formData.EnableIPv6 && formData.IPv6Subnet.trim()) {
                payload.IPAM.Config.push({
                    Subnet: formData.IPv6Subnet.trim(),
                    Gateway: formData.IPv6Gateway.trim() || undefined
                });
            }
            if (payload.IPAM.Config.length === 0) delete payload.IPAM;

            // 移除 undefined 字段
            Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

            await axios.post('/api/networks', payload);
            onCreated();
            onClose();
        } catch (error) {
            console.error('Failed to create network:', error);
            alert(`创建失败: ${error.response?.data?.error || error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const addOption = () => set({ Options: [...formData.Options, { key: '', value: '' }] });
    const updateOption = (idx, field, val) => {
        const opts = [...formData.Options];
        opts[idx][field] = val;
        set({ Options: opts });
    };
    const removeOption = (idx) => set({ Options: formData.Options.filter((_, i) => i !== idx) });

    // 样式快捷
    const inputCls = `w-full px-4 py-2.5 rounded-lg border ${isDark
        ? 'bg-black/20 border-white/10 text-white placeholder-gray-500'
        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
    } focus:ring-2 focus:ring-blue-500/50 outline-none transition-all`;

    const sectionCls = `p-4 rounded-lg border ${isDark
        ? 'bg-white/5 border-white/10'
        : 'bg-gray-50 border-gray-200'
    }`;

    const labelCls = `block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`;
    const subLabelCls = `text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-2xl border shadow-2xl max-h-[90vh] overflow-y-auto`}>
                {/* 标题栏 */}
                <div className={`p-6 border-b ${isDark ? 'border-white/10' : 'border-gray-100'} flex items-center justify-between sticky top-0 ${isDark ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur z-10`}>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('network.create')}
                    </h2>
                    <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    {/* ── 网络名称 ── */}
                    <div className="space-y-1.5">
                        <label className={labelCls}>
                            <span className="text-red-500 mr-1">*</span>{t('common.name')}
                        </label>
                        <input
                            type="text" required
                            value={formData.Name}
                            onChange={e => set({ Name: e.target.value })}
                            placeholder={t('network.name_placeholder')}
                            className={inputCls}
                        />
                    </div>

                    {/* ── 驱动类型 ── */}
                    <div className="space-y-1.5">
                        <label className={labelCls}>{t('network.driver')}</label>
                        <select
                            value={formData.Driver}
                            onChange={e => handleDriverChange(e.target.value)}
                            className={`${inputCls} cursor-pointer`}
                        >
                            <option value="bridge">bridge — 标准桥接网络（默认）</option>
                            <option value="macvlan">macvlan — 容器直接接入物理网络</option>
                            <option value="ipvlan">ipvlan — 共享 MAC 的虚拟网络</option>
                            <option value="overlay">overlay — 跨主机 Swarm 网络</option>
                            <option value="host">host — 共享宿主机网络栈</option>
                            <option value="null">null — 完全隔离（无网络）</option>
                        </select>
                    </div>

                    {/* ── host / null 驱动说明 ── */}
                    {isSimpleDriver && (
                        <div className={`${sectionCls} flex items-start gap-3`}>
                            <span className="text-2xl">{formData.Driver === 'host' ? '🖥️' : '🚫'}</span>
                            <div>
                                <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {formData.Driver === 'host'
                                        ? 'host 网络：容器直接使用宿主机网络栈'
                                        : 'null 网络：容器完全没有网络接口'}
                                </p>
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {formData.Driver === 'host'
                                        ? '不创建独立网络命名空间，容器端口即宿主机端口，无需端口映射。每台主机只能有一个 host 网络。'
                                        : '只有 loopback 接口，适合不需要网络的纯计算任务或安全隔离场景。'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── macvlan / ipvlan 物理网卡 ── */}
                    {caps.parent && (
                        <div className={`${sectionCls} space-y-4`}>
                            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                                {formData.Driver === 'macvlan' ? 'macvlan' : 'ipvlan'} 配置
                            </p>

                            {/* Parent 网卡 */}
                            <div className="space-y-1.5">
                                <label className={labelCls}>
                                    <span className="text-red-500 mr-1">*</span>
                                    物理网卡（Parent Interface）
                                </label>
                                <input
                                    type="text"
                                    value={formData.Parent}
                                    onChange={e => set({ Parent: e.target.value })}
                                    placeholder="例：eth0、eno1、enp3s0"
                                    className={inputCls}
                                />
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    容器将直接接入该物理网卡所在的网段，需与子网配置匹配。可用 <code className="font-mono">ip link show</code> 查看宿主机网卡名称。
                                </p>
                            </div>

                            {/* 子模式 */}
                            <div className="space-y-1.5">
                                <label className={labelCls}>
                                    工作模式
                                </label>
                                <select
                                    value={formData.VlanMode}
                                    onChange={e => set({ VlanMode: e.target.value })}
                                    className={`${inputCls} cursor-pointer`}
                                >
                                    {(formData.Driver === 'macvlan' ? MACVLAN_MODES : IPVLAN_MODES).map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* ── 开关选项（仅对支持的驱动显示） ── */}
                    {!isSimpleDriver && (
                        <div className={`${sectionCls} space-y-3`}>
                            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                网络选项
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {/* 自定义 IPv4 */}
                                {caps.ipam && (
                                    <ToggleField
                                        label="自定义 IPv4 子网"
                                        checked={formData.EnableIPv4}
                                        onChange={v => set({ EnableIPv4: v })}
                                        isDark={isDark}
                                    />
                                )}
                                {/* 隔离外网 */}
                                {caps.internal && (
                                    <ToggleField
                                        label="隔离外部访问"
                                        checked={formData.Internal}
                                        onChange={v => set({ Internal: v })}
                                        isDark={isDark}
                                    />
                                )}
                                {/* 允许附加（仅 overlay）*/}
                                {caps.attachable && (
                                    <ToggleField
                                        label="允许手动附加"
                                        checked={formData.Attachable}
                                        onChange={v => set({ Attachable: v })}
                                        isDark={isDark}
                                    />
                                )}
                                {/* IPv6 */}
                                {caps.ipv6 && (
                                    <ToggleField
                                        label="启用 IPv6"
                                        checked={formData.EnableIPv6}
                                        onChange={v => set({ EnableIPv6: v })}
                                        isDark={isDark}
                                    />
                                )}
                            </div>

                            {/* 字段说明 */}
                            <div className={`text-xs space-y-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {caps.internal && <p>• <b>隔离外部访问</b>：容器只能与同网络内容器通信，无法访问互联网</p>}
                                {caps.attachable && <p>• <b>允许手动附加</b>（overlay 专属）：普通容器可通过 <code className="font-mono">docker network connect</code> 加入此 Swarm 网络</p>}
                            </div>
                        </div>
                    )}

                    {/* ── IPv4 子网配置 ── */}
                    {caps.ipam && formData.EnableIPv4 && (
                        <div className={`${sectionCls} space-y-3`}>
                            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                IPv4 配置
                                {(formData.Driver === 'macvlan' || formData.Driver === 'ipvlan') && (
                                    <span className="ml-2 text-orange-400">（须与物理网络网段一致）</span>
                                )}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className={subLabelCls}>{t('network.ipv4_subnet')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('network.subnet_placeholder')}
                                        value={formData.IPv4Subnet}
                                        onChange={e => set({ IPv4Subnet: e.target.value })}
                                        className={inputCls}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={subLabelCls}>{t('network.ipv4_gateway')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('network.gateway_placeholder')}
                                        value={formData.IPv4Gateway}
                                        onChange={e => set({ IPv4Gateway: e.target.value })}
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── IPv6 子网配置 ── */}
                    {caps.ipv6 && formData.EnableIPv6 && (
                        <div className={`${sectionCls} space-y-3`}>
                            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                IPv6 配置
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className={subLabelCls}>{t('network.ipv6_subnet')}</label>
                                    <input
                                        type="text"
                                        placeholder="例：2001:db8::/64"
                                        value={formData.IPv6Subnet}
                                        onChange={e => set({ IPv6Subnet: e.target.value })}
                                        className={inputCls}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={subLabelCls}>{t('network.ipv6_gateway')}</label>
                                    <input
                                        type="text"
                                        placeholder="例：2001:db8::1"
                                        value={formData.IPv6Gateway}
                                        onChange={e => set({ IPv6Gateway: e.target.value })}
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── 自定义驱动参数（高级，非 host/null 显示） ── */}
                    {!isSimpleDriver && (
                        <div className="space-y-2">
                            <label className={labelCls}>{t('network.custom_driver_opts')}</label>
                            <div className="space-y-2">
                                {formData.Options.map((opt, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            type="text" placeholder="Key"
                                            value={opt.key}
                                            onChange={e => updateOption(idx, 'key', e.target.value)}
                                            className={`flex-1 px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                                        />
                                        <input
                                            type="text" placeholder="Value"
                                            value={opt.value}
                                            onChange={e => updateOption(idx, 'value', e.target.value)}
                                            className={`flex-1 px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                                        />
                                        <button
                                            type="button" onClick={() => removeOption(idx)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button" onClick={addOption}
                                    className={`w-full py-2 border border-dashed rounded-lg text-sm transition-colors ${isDark ? 'border-white/20 text-gray-400 hover:border-white/40' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}
                                >
                                    + {t('network.add_option')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── 提交按钮 ── */}
                    <div className={`flex justify-end gap-3 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                        <button
                            type="button" onClick={onClose}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit" disabled={submitting}
                            className="px-6 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white transition-colors"
                        >
                            {submitting ? '创建中...' : t('common.confirm')}
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

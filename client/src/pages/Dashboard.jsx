import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Container, Image, Boxes, HardDrive, Network, Server, LogOut,
    Cpu, MemoryStick, Sun, Moon, Globe, Database, Info,
    HardDriveIcon, WifiIcon, ChevronRight, ArrowUp, ArrowDown
} from 'lucide-react';
import axios from 'axios';
import { useThemeStore } from '../store/themeStore';
import { useEndpoint } from '../context/EndpointContext';
import EndpointSelector from '../components/EndpointSelector';
import CircularProgress from '../components/CircularProgress';
import UniversalTreeMap from '../components/ContainerTreeMap';

import { APP_VERSION } from '../constants';

export default function Dashboard() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [systemInfo, setSystemInfo] = useState(null);
    const [stats, setStats] = useState(null);
    const [usage, setUsage] = useState(null);
    const [disk, setDisk] = useState(null);
    const [network, setNetwork] = useState(null);
    const [containerStats, setContainerStats] = useState([]);
    const [imageStats, setImageStats] = useState([]);
    const [volumeStats, setVolumeStats] = useState([]);
    const [activeTab, setActiveTab] = useState('containers');
    const [dataSource, setDataSource] = useState('local');
    const { theme, toggleTheme } = useThemeStore();
    const { refreshEndpoints, endpoints, currentEndpoint } = useEndpoint();

    useEffect(() => {
        refreshEndpoints();
    }, []);

    useEffect(() => {
        // Clear previous data to give visual feedback
        setSystemInfo(null);
        setStats(null);
        setUsage(null);
        setDisk(null);
        setNetwork(null);

        fetchAllData();
        const interval = setInterval(fetchAllData, 10000);
        return () => clearInterval(interval);
    }, [currentEndpoint]);

    const fetchAllData = async () => {
        try {
            const response = await axios.get('/api/dashboard/batch');
            const data = response.data;

            setSystemInfo(data.systemInfo);
            setStats(data.stats);
            setUsage(data.usage);
            setDisk(data.disk);
            setNetwork(data.network);
            setContainerStats(data.containerStats);
            setImageStats(data.imageStats);
            setVolumeStats(data.volumeStats);
            setDataSource(data.dataSource || 'local');
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
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
    const currentEndpointData = endpoints.find(e => e.id === currentEndpoint);

    const getCurrentTreeMapData = () => {
        if (activeTab === 'containers') return containerStats;
        if (activeTab === 'images') return imageStats;
        if (activeTab === 'volumes') return volumeStats;
        return [];
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
                    <NavItem icon={<LayoutDashboard />} label={t('nav.dashboard')} active isDark={isDark} />
                    <NavItem icon={<Container />} label={t('nav.containers')} onClick={() => navigate('/containers')} isDark={isDark} />
                    <NavItem icon={<Boxes />} label={t('nav.stacks')} onClick={() => navigate('/stacks')} isDark={isDark} />
                    <NavItem icon={<Image />} label={t('nav.images')} onClick={() => navigate('/images')} isDark={isDark} />
                    <NavItem icon={<HardDrive />} label={t('nav.volumes')} onClick={() => navigate('/volumes')} isDark={isDark} />
                    <NavItem icon={<Network />} label={t('nav.networks')} onClick={() => navigate('/networks')} isDark={isDark} />
                    <NavItem icon={<Server />} label={t('nav.endpoints')} onClick={() => navigate('/endpoints')} isDark={isDark} />
                </nav>

                <div className="absolute bottom-4 left-4 right-4 space-y-3">
                    <EndpointSelector isDark={isDark} popupDirection="up" />
                    <button onClick={handleLogout} className={`w-full ${isDark ? 'glass glass-hover' : 'bg-red-50 hover:bg-red-100'} p-3 rounded-lg flex items-center gap-2 text-red-400 transition-colors`}>
                        <LogOut className="w-5 h-5" />
                        {t('auth.logout')}
                    </button>
                </div>
            </aside>

            <main className="ml-72 p-8">
                {/* 顶部标题栏 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('nav.dashboard')}</h1>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('dashboard.system_overview')} {dataSource === 'aggregated' ? `· ${t('dashboard.remote_node')}` : ''}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={toggleLanguage} className={`${isDark ? 'glass glass-hover text-white' : 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-700'} p-3 rounded-lg transition-all`}>
                            <Globe className="w-5 h-5" />
                        </button>
                        <button onClick={toggleTheme} className={`${isDark ? 'glass glass-hover text-white' : 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-700'} p-3 rounded-lg transition-all`}>
                            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* 上半部分：2块布局 - 基础信息(3) + 资源监控(9) */}
                <div className="grid grid-cols-12 gap-6 mb-6">
                    {/* 左块：基础信息 */}
                    <div className={`col-span-3 ${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-lg p-5 border`}>
                        <div className="flex items-center gap-2 mb-3">
                            <Info className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                            <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.basic_info')}</h2>
                        </div>
                        {
                            systemInfo && (
                                <div className="space-y-1.5 text-xs">
                                    <InfoRow label={t('dashboard.node_info')} value={currentEndpointData?.name || t('endpoint.local')} isDark={isDark} />
                                    <InfoRow label={t('dashboard.docker_version')} value={`${systemInfo.ServerVersion}`} isDark={isDark} />
                                    <InfoRow label={t('dashboard.os_info')} value={systemInfo.OperatingSystem} isDark={isDark} />
                                    <InfoRow label={t('dashboard.arch')} value={systemInfo.Architecture} isDark={isDark} />
                                    <InfoRow label="Cpu / Mem" value={`${systemInfo.NCPU} Core / ${(systemInfo.MemTotal / 1024 / 1024 / 1024).toFixed(2)} GB`} isDark={isDark} />
                                    <InfoRow label={t('dashboard.storage_driver')} value={systemInfo.Driver} isDark={isDark} />
                                    <InfoRow label={t('dashboard.network_plugins')} value={systemInfo.Plugins?.Network ? systemInfo.Plugins.Network.join(', ') : 'N/A'} isDark={isDark} />
                                </div>
                            )
                        }
                    </div>

                    {/* 右块：资源监控 (CPU/内存/磁盘/网络) */}
                    <div className={`col-span-9 ${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-lg p-5 border flex items-center justify-between`}>
                        {/* CPU */}
                        <div className="flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-2">
                                <Cpu className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('container.cpu')}</h2>
                            </div>
                            {
                                usage && (
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <CircularProgress
                                            percent={usage.cpu.usage}
                                            size={110}
                                            strokeWidth={10}
                                            isDark={isDark}
                                        />
                                        <div className="mt-2 text-center">
                                            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                {usage.cpu.cores} Core
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        </div>

                        {/* 间距 */}
                        <div className="w-px h-32 bg-gray-200 dark:bg-white/10 mx-4"></div>

                        {/* 内存 */}
                        <div className="flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-2">
                                <MemoryStick className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('container.memory')}</h2>
                            </div>
                            {
                                usage && (
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <CircularProgress
                                            percent={usage.memory.usagePercent}
                                            size={110}
                                            strokeWidth={10}
                                            isDark={isDark}
                                        />
                                        <div className="mt-2 text-center">
                                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {usage.memory.usedFormatted} / {usage.memory.totalFormatted}
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        </div>

                        {/* 间距 */}
                        <div className="w-px h-32 bg-gray-200 dark:bg-white/10 mx-4"></div>

                        {/* 磁盘 */}
                        <div className="flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                                <HardDriveIcon className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.disk_usage')}</h2>
                            </div>
                            {
                                disk && (
                                    <div className="flex-1 flex flex-col justify-center space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('dashboard.write')}</span>
                                            </div>
                                            <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>0 B/s</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ArrowDown className="w-3.5 h-3.5 text-green-400" />
                                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('dashboard.read')}</span>
                                            </div>
                                            <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>0 B/s</span>
                                        </div>
                                        <div className={`pt-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                                            <div className="space-y-0.5">
                                                <InfoRow label={t('dashboard.usage')} value={`${disk.usagePercent}%`} isDark={isDark} small />
                                                <InfoRow label={t('dashboard.capacity')} value={disk.totalFormatted} isDark={isDark} small />
                                                <InfoRow label={t('dashboard.available')} value={disk.availableFormatted} isDark={isDark} small />
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        </div>

                        {/* 间距 */}
                        <div className="w-px h-32 bg-gray-200 dark:bg-white/10 mx-4"></div>

                        {/* 网络 */}
                        <div className="flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-3">
                                <WifiIcon className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('nav.networks')}</h2>
                            </div>
                            {
                                network && (
                                    <div className="flex-1 flex flex-col justify-center space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ArrowUp className="w-3.5 h-3.5 text-orange-400" />
                                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('dashboard.tx')}</span>
                                            </div>
                                            <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{network.txFormatted}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('dashboard.rx')}</span>
                                            </div>
                                            <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{network.rxFormatted}</span>
                                        </div>
                                        <div className={`pt-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                                            <div className="space-y-0.5">
                                                <InfoRow label={t('dashboard.usage')} value="0%" isDark={isDark} small />
                                                <InfoRow label={t('dashboard.total_tx')} value="0 GB" isDark={isDark} small />
                                                <InfoRow label={t('dashboard.total_rx')} value="0 GB" isDark={isDark} small />
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        </div>
                    </div>
                </div>

                {/* 下半部分：用量统计 TreeMap */}
                <div className="grid grid-cols-12 gap-6">
                    <div className={`col-span-9 ${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-lg p-3 border`}>
                        <div className="flex items-center gap-2 mb-3">
                            <Database className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.usage_stats')}</h2>
                        </div>

                        <div className="flex gap-2 mb-3">
                            <TabButton label={t('nav.containers')} active={activeTab === 'containers'} onClick={() => setActiveTab('containers')} isDark={isDark} />
                            <TabButton label={t('nav.images')} active={activeTab === 'images'} onClick={() => setActiveTab('images')} isDark={isDark} />
                            <TabButton label={t('nav.volumes')} active={activeTab === 'volumes'} onClick={() => setActiveTab('volumes')} isDark={isDark} />
                        </div>

                        <div className="w-full">
                            <UniversalTreeMap
                                data={getCurrentTreeMapData()}
                                type={activeTab === 'containers' ? 'container' : activeTab === 'images' ? 'image' : 'volume'}
                                width={1120}
                                height={495}
                                isDark={isDark}
                                onItemClick={(item) => {
                                    if (activeTab === 'containers') navigate('/containers');
                                    else if (activeTab === 'images') navigate('/images');
                                    else navigate('/volumes');
                                }}
                            />
                        </div>
                    </div>

                    <div className={`col-span-3 ${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-lg p-6 border`}>
                        <div className="space-y-4">
                            <StatsCard icon={<Container className="w-5 h-5" />} title={t('nav.containers')} value={stats?.containers.total || 0} subtitle={t('dashboard.running_count', { count: stats?.containers.running || 0 })} color="blue" onClick={() => navigate('/containers')} isDark={isDark} />
                            <StatsCard icon={<Image className="w-5 h-5" />} title={t('nav.images')} value={stats?.images.total || 0} subtitle={t('dashboard.image_count', { count: stats?.images.total || 0 })} color="green" onClick={() => navigate('/images')} isDark={isDark} />
                            <StatsCard icon={<HardDrive className="w-5 h-5" />} title={t('nav.volumes')} value={stats?.volumes.total || 0} subtitle={t('dashboard.volume_count')} color="purple" onClick={() => navigate('/volumes')} isDark={isDark} />
                            <StatsCard icon={<Network className="w-5 h-5" />} title={t('nav.networks')} value={stats?.networks.total || 0} subtitle={t('dashboard.network_count')} color="orange" onClick={() => navigate('/networks')} isDark={isDark} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function InfoRow({ label, value, isDark, small }) {
    const textSize = small ? 'text-xs' : 'text-xs';
    return (
        <div className="flex items-center justify-between py-0.5">
            <span className={`${textSize} ${isDark ? 'text-gray-400' : 'text-gray-600'} truncate mr-2`}>{label}</span>
            <span className={`${textSize} font-medium ${isDark ? 'text-white' : 'text-gray-900'} text-right`}>{value}</span>
        </div>
    );
}

function TabButton({ label, active, onClick, isDark }) {
    return (
        <button onClick={onClick} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? isDark ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-cyan-50 text-cyan-600 border border-cyan-200' : isDark ? 'text-gray-400 hover:bg-white/5 border border-transparent' : 'text-gray-600 hover:bg-gray-100 border border-transparent'}`}>
            {label}
        </button>
    );
}

function StatsCard({ icon, title, value, subtitle, color, onClick, isDark }) {
    const colorClasses = { blue: 'text-blue-500', green: 'text-green-500', purple: 'text-purple-500', orange: 'text-orange-500' };
    return (
        <button onClick={onClick} className={`w-full ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'} rounded-lg p-4 transition-all text-left group`}>
            <div className="flex items-center justify-between mb-2">
                <div className={colorClasses[color]}>{icon}</div>
                <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-600' : 'text-gray-400'} group-hover:translate-x-1 transition-transform`} />
            </div>
            <div className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{title}</div>
            <div className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</div>
            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{subtitle}</div>
        </button>
    );
}

function NavItem({ icon, label, active, onClick, isDark }) {
    return (
        <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-50 text-cyan-600' : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
            {icon}
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}

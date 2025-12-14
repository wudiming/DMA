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
    MoreVertical
} from 'lucide-react';
import axios from 'axios';
import { useThemeStore } from '../store/themeStore';
import { useEndpoint } from '../context/EndpointContext';
import EndpointSelector from '../components/EndpointSelector';
import { APP_VERSION } from '../constants';

export default function Volumes() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useThemeStore();
    const [volumes, setVolumes] = useState([]);
    const [actionMenuId, setActionMenuId] = useState(null);
    const { refreshEndpoints, currentEndpoint } = useEndpoint();

    useEffect(() => {
        refreshEndpoints();
    }, []);

    useEffect(() => {
        setVolumes([]); // Clear previous data
        fetchVolumes();
    }, [currentEndpoint]);

    const fetchVolumes = async () => {
        try {
            const response = await axios.get('/api/volumes');
            const volumesData = (response.data && Array.isArray(response.data.Volumes)) ? response.data.Volumes : [];
            // 默认按名称排序
            volumesData.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
            setVolumes(volumesData);
        } catch (error) {
            console.error('Failed to fetch volumes:', error);
        }
    };

    const handleRemove = async (volume) => {
        if (!confirm(t('volume.delete_confirm', { name: volume.Name }))) return;

        try {
            await axios.delete(`/api/volumes/${volume.Name}`);
            fetchVolumes();
            setActionMenuId(null);
        } catch (error) {
            console.error('Failed to remove volume:', error);
            alert(`删除失败: ${error.message}`);
        }
    };

    const handlePrune = async () => {
        if (!confirm(t('volume.prune_confirm'))) return;

        try {
            const response = await axios.post('/api/volumes/prune');
            const count = response.data.VolumesDeleted?.length || 0;
            alert(t('volume.prune_success', { count }));
            fetchVolumes();
        } catch (error) {
            console.error('Failed to prune volumes:', error);
            alert(`清理失败: ${error.message}`);
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
                    <NavItem icon={<HardDrive />} label={t('nav.volumes')} active isDark={isDark} />
                    <NavItem icon={<NetworkIcon />} label={t('nav.networks')} onClick={() => navigate('/networks')} isDark={isDark} />
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
                            {t('nav.volumes')}
                        </h1>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('dashboard.total')} {volumes.length} {t('dashboard.volume_count')}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handlePrune}
                            className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${isDark
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                                }`}
                        >
                            <Trash2 className="w-5 h-5" />
                            <span>{t('volume.prune')}</span>
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
                    {volumes.length === 0 ? (
                        <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-12 border text-center`}>
                            <HardDrive className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('volume.no_volumes')}</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('volume.no_volumes_desc')}
                            </p>
                        </div>
                    ) : (
                        volumes.map((volume) => (
                            <VolumeCard
                                key={volume.Name}
                                volume={volume}
                                isDark={isDark}
                                handleRemove={handleRemove}
                            />
                        ))
                    )}
                </div>
            </main>
        </div >
    );
}

function VolumeCard({ volume, isDark, handleRemove }) {
    const { t } = useTranslation();
    const created = volume.CreatedAt ? new Date(volume.CreatedAt).toLocaleDateString() : '-';
    const isUsed = volume.Containers && volume.Containers.length > 0;

    return (
        <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-4 border transition-all hover:shadow-md`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'} flex items-center justify-center flex-shrink-0`}>
                        <HardDrive className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className={`text-lg font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`} title={volume.Name}>
                                {volume.Name}
                            </h3>
                            {isUsed ? (
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${isDark ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                    {volume.Containers.join(', ')}
                                </span>
                            ) : (
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${isDark ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                                    {t('common.unused')}
                                </span>
                            )}
                        </div>
                        <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <span className="font-mono">{t('volume.driver')}: {volume.Driver}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span className="truncate max-w-md" title={volume.Mountpoint}>{t('volume.mountpoint')}: {volume.Mountpoint}</span>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <span>{t('common.created')}: {created}</span>
                        </div>
                    </div>

                    {!isUsed && (
                        <div className="relative ml-4">
                            <button
                                onClick={() => handleRemove(volume)}
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

function NavItem({ icon, label, active, onClick, isDark }) {
    return (
        <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-50 text-cyan-600' : isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
            {icon}
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}

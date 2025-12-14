import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    Container,
    Image as ImageIcon,
    Boxes,
    HardDrive,
    Network,
    Server,
    LogOut,
    Sun,
    Moon,
    Globe,
    Trash2,
    Download,
    Search,
    Tag,
    Clock,
    FileDigit,
    Hash,
    Play
} from 'lucide-react';
import CreateContainerModal from '../components/CreateContainerModal';
import axios from 'axios';
import { useThemeStore } from '../store/themeStore';
import { useEndpoint } from '../context/EndpointContext';
import PullImageModal from '../components/PullImageModal';
import EndpointSelector from '../components/EndpointSelector';
import { APP_VERSION } from '../constants';

export default function Images() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useThemeStore();
    const [images, setImages] = useState([]);
    const [showPullModal, setShowPullModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const { refreshEndpoints, currentEndpoint } = useEndpoint();

    useEffect(() => {
        refreshEndpoints();
    }, []);

    useEffect(() => {
        setImages([]); // Clear previous data to give visual feedback
        fetchImages();
    }, [currentEndpoint]);

    const fetchImages = async () => {
        try {
            const response = await axios.get('/api/images');
            const imagesData = Array.isArray(response.data) ? response.data : [];

            // 默认按名称排序 (RepoTags[0])
            imagesData.sort((a, b) => {
                const nameA = a.RepoTags && a.RepoTags.length > 0 ? a.RepoTags[0] : a.Id;
                const nameB = b.RepoTags && b.RepoTags.length > 0 ? b.RepoTags[0] : b.Id;
                return nameA.localeCompare(nameB);
            });

            setImages(imagesData);
        } catch (error) {
            console.error('Failed to fetch images:', error);
        }
    };

    const handleRemove = async (image) => {
        const imageName = image.RepoTags ? image.RepoTags[0] : image.Id.substring(0, 12);
        if (!confirm(t('image.delete_confirm', { id: imageName }))) return;

        try {
            await axios.delete(`/api/images/${image.Id}`);
            fetchImages();
        } catch (error) {
            console.error('Failed to remove image:', error);
            alert(`删除失败: ${error.message}`);
        }
    };

    const handlePrune = async (image) => {
        if (!confirm(t('image.prune_confirm'))) return;

        try {
            const response = await axios.post('/api/images/prune');
            const spaceReclaimed = response.data.SpaceReclaimed || 0;
            const spaceFormatted = (spaceReclaimed / 1024 / 1024).toFixed(2);
            alert(t('image.prune_success', { size: spaceFormatted }));
            fetchImages();
        } catch (error) {
            console.error('Failed to prune images:', error);
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

    const handleCreateContainer = (image) => {
        setSelectedImage(image);
        setShowCreateModal(true);
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
                    <NavItem icon={<ImageIcon />} label={t('nav.images')} active isDark={isDark} />
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
                            {t('nav.images')}
                        </h1>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('dashboard.total')} {images.length} {t('nav.images')}
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
                            <span>{t('image.prune')}</span>
                        </button>

                        <button
                            onClick={() => setShowPullModal(true)}
                            className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${isDark
                                ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                                }`}
                        >
                            <Download className="w-5 h-5" />
                            <span>{t('image.pull')}</span>
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
                    {images.length === 0 ? (
                        <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-12 border text-center`}>
                            <ImageIcon className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('image.no_images')}</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('image.no_images_desc')}
                            </p>
                        </div>
                    ) : (
                        images.map((image) => (
                            <ImageCard
                                key={image.Id}
                                image={image}
                                isDark={isDark}
                                handleRemove={handleRemove}
                                onRun={handleCreateContainer}
                            />
                        ))
                    )}
                </div>
            </main>

            {showPullModal && (
                <PullImageModal
                    onClose={() => setShowPullModal(false)}
                    onSuccess={() => {
                        setShowPullModal(false);
                        fetchImages();
                    }}
                    isDark={isDark}
                />
            )}

            {showCreateModal && (
                <CreateContainerModal
                    isDark={isDark}
                    onClose={() => {
                        setShowCreateModal(false);
                        setSelectedImage(null);
                    }}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        setSelectedImage(null);
                        if (confirm(t('container.create_success_confirm'))) {
                            navigate('/containers');
                        }
                    }}
                    initialData={selectedImage ? {
                        image: selectedImage.RepoTags && selectedImage.RepoTags.length > 0 ? selectedImage.RepoTags[0] : selectedImage.Id
                    } : null}
                />
            )}
        </div>
    );
}

function ImageCard({ image, isDark, handleRemove, onRun }) {
    const { t } = useTranslation();
    const created = new Date(image.Created * 1000).toLocaleDateString();
    const size = (image.Size / 1024 / 1024).toFixed(2) + ' MB';
    const shortId = image.Id.split(':')[1].substring(0, 12);
    const shortDigest = image.RepoDigests && image.RepoDigests.length > 0
        ? image.RepoDigests[0].split('@')[1].substring(0, 12)
        : '-';
    const tags = image.RepoTags || ['<none>:<none>'];
    const isUsed = image.Containers && image.Containers.length > 0;

    return (
        <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-4 border transition-all hover:shadow-md`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} flex items-center justify-center flex-shrink-0`}>
                        <ImageIcon className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {tags.map((tag, index) => (
                                <h3 key={index} className={`text-lg font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`} title={tag}>
                                    {tag}
                                </h3>
                            ))}
                            {isUsed ? (
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${isDark ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-700 border border-green-200'}`}>
                                    {image.Containers.join(', ')}
                                </span>
                            ) : (
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${isDark ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                                    {t('common.unused')}
                                </span>
                            )}
                        </div>
                        <div className={`flex items-center gap-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <div className="flex items-center gap-1">
                                <span className="font-mono">{shortId}</span>
                            </div>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <div className="flex items-center gap-1">
                                <span className="font-mono">{shortDigest}</span>
                            </div>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <div className="flex items-center gap-1">
                                <span>{size}</span>
                            </div>
                            <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                            <div className="flex items-center gap-1">
                                <span>{created}</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative ml-4 flex gap-2">
                        <button
                            onClick={() => onRun(image)}
                            className={`p-2.5 rounded-lg ${isDark
                                ? 'hover:bg-green-500/10 text-green-400 hover:text-green-300'
                                : 'hover:bg-green-50 text-green-600 hover:text-green-700'
                                } transition-colors`}
                            title={t('container.create')}
                        >
                            <Play className="w-5 h-5" />
                        </button>

                        {!isUsed && (
                            <button
                                onClick={() => handleRemove(image)}
                                className={`p-2.5 rounded-lg ${isDark
                                    ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300'
                                    : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                                    } transition-colors`}
                                title={t('image.delete_confirm', { id: '' }).replace('?', '')}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
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

import { useState, useEffect, useRef } from 'react';
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
  Play,
  Square,
  RotateCw,
  FileText,
  Terminal,
  Trash2,
  Sun,
  Moon,
  Globe,
  Plus,
  RefreshCw,
  Cpu,
  HardDriveIcon,
  Pause,
  PlayCircle,
  Edit,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Wifi,
  FolderOpen
} from 'lucide-react';
import axios from 'axios';
import { useThemeStore } from '../store/themeStore';
import { useEndpoint } from '../context/EndpointContext';
import ContainerLogs from '../components/ContainerLogs';
import CreateContainerModal from '../components/CreateContainerModal';
import UpdateContainerModal from '../components/UpdateContainerModal';
import ContainerTerminal from '../components/ContainerTerminal';
import EndpointSelector from '../components/EndpointSelector';
import UpdateProgressDialog from '../components/UpdateProgressDialog';
import ErrorBoundary from '../components/ErrorBoundary';
import { APP_VERSION } from '../constants';
import React from 'react';

export default function Containers() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const { refreshEndpoints, currentEndpoint } = useEndpoint();
  const [containers, setContainers] = useState([]);
  const [images, setImages] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateContainer, setUpdateContainer] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(new Map());
  const [updateErrors, setUpdateErrors] = useState(new Map());
  const [containerStats, setContainerStats] = useState(new Map());
  const [clickedContainer, setClickedContainer] = useState(null);
  const [menuRef] = useState(useRef(null));
  const [terminalContainer, setTerminalContainer] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [showUpdateProgress, setShowUpdateProgress] = useState(false);
  const [updateContainersList, setUpdateContainersList] = useState([]);
  const [deleteModal, setDeleteModal] = useState({ show: false, container: null });

  useEffect(() => {
    refreshEndpoints();
  }, []);

  useEffect(() => {
    setContainers([]); // Clear previous data
    fetchContainers();
    fetchImages(); // Fetch images to resolve names
    const interval = setInterval(() => {
      fetchContainers();
      fetchImages(); // Keep images in sync
    }, 3000);
    return () => clearInterval(interval);
  }, [currentEndpoint]);


  // 手动检查更新功能已保留，移除了自动检查逻辑

  useEffect(() => {
    const fetchStats = async () => {
      if (containers.length === 0) return;

      try {
        // 使用批量stats API获取所有容器统计信息
        const response = await axios.get('/api/containers/stats/batch');
        const statsData = response.data;

        // 更新状态
        setContainerStats(new Map(Object.entries(statsData)));
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    if (containers.length > 0) {
      fetchStats();
      // 延长更新间隔到10秒，减少服务器压力
      const statsInterval = setInterval(fetchStats, 10000);
      return () => clearInterval(statsInterval);
    }
  }, [containers]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setClickedContainer(null);
      }
    };

    if (clickedContainer) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [clickedContainer]);

  const fetchContainers = async () => {
    try {
      const response = await axios.get('/api/containers');
      const sorted = response.data.sort((a, b) => {
        const nameA = a.Names[0]?.replace(/^\//, '') || '';
        const nameB = b.Names[0]?.replace(/^\//, '') || '';
        return nameA.localeCompare(nameB);
      });
      setContainers(sorted);
    } catch (error) {
      console.error('Failed to fetch containers:', error);
    }
  };

  const fetchImages = async () => {
    try {
      const response = await axios.get('/api/images');
      setImages(response.data);
    } catch (error) {
      console.error('Failed to fetch images:', error);
    }
  };

  const checkSingleUpdate = async (containerId) => {
    setUpdateStatus(prev => new Map(prev).set(containerId, 'checking'));
    try {
      const response = await axios.get(`/api/containers/${containerId}/check-update`);
      // 优先使用后端返回的 status 字段
      const status = response.data.status || (response.data.hasUpdate ? 'available' : 'latest');
      setUpdateStatus(prev => new Map(prev).set(containerId, status));
      if (response.data.error) {
        setUpdateErrors(prev => new Map(prev).set(containerId, response.data.error));
      } else {
        setUpdateErrors(prev => {
          const next = new Map(prev);
          next.delete(containerId);
          return next;
        });
      }
    } catch (error) {
      setUpdateStatus(prev => new Map(prev).set(containerId, 'error'));
      setUpdateErrors(prev => new Map(prev).set(containerId, error.message));
    }
  };

  const checkAllUpdates = async () => {
    setCheckingAll(true);
    const containerIds = containers.map(c => c.Id);

    // 初始化所有状态为 checking
    const newStatus = new Map(updateStatus);
    containerIds.forEach(id => newStatus.set(id, 'checking'));
    setUpdateStatus(newStatus);

    try {
      const response = await axios.post('/api/containers/check-update/batch', { ids: containerIds });
      const results = response.data;

      setUpdateStatus(prev => {
        const next = new Map(prev);
        Object.entries(results).forEach(([id, result]) => {
          const status = result.status || (result.hasUpdate ? 'available' : 'latest');
          next.set(id, status);
        });
        return next;
      });
    } catch (error) {
      console.error('Batch update check failed:', error);
      // 批量失败回退到错误状态
      setUpdateStatus(prev => {
        const next = new Map(prev);
        containerIds.forEach(id => {
          if (next.get(id) === 'checking') {
            next.set(id, 'error');
          }
        });
        return next;
      });
    } finally {
      setCheckingAll(false);
    }
  };

  const prepareContainerData = async (containerId) => {
    const response = await axios.get(`/api/containers/${containerId}`);
    const container = response.data;

    return {
      name: container.Name?.replace(/^\//, '') || '',
      image: container.Config?.Image,
      ports: container.HostConfig?.PortBindings ? Object.entries(container.HostConfig.PortBindings).map(([containerPort, hostBindings]) => {
        const port = containerPort.split('/')[0];
        const hostPort = hostBindings && hostBindings[0] ? hostBindings[0].HostPort : '';
        return hostPort ? `${hostPort}:${port}` : port;
      }) : [],
      volumes: container.Mounts?.map(m =>
        `${m.Source ? m.Source : m.Name}:${m.Destination}`
      ) || [],
      env: container.Config?.Env || [],
      restart: container.HostConfig?.RestartPolicy?.Name || 'no',
      network: container.HostConfig?.NetworkMode || 'bridge',
      labels: container.Config?.Labels || {}
    };
  };

  const updateSingleContainer = async (containerId) => {
    try {
      const data = await prepareContainerData(containerId);
      setUpdateContainersList([data]);
      setShowUpdateProgress(true);
    } catch (error) {
      alert(`准备更新失败: ${error.message}`);
    }
  };

  const updateAllContainers = async () => {
    // 1. 找出所有未检查或有更新的容器
    const containersToUpdate = [];
    const containersToCheck = [];

    for (const container of containers) {
      const status = updateStatus.get(container.Id);
      if (status === 'available') {
        containersToUpdate.push(container);
      } else if (!status || status === 'checking') {
        containersToCheck.push(container);
      }
    }

    // 2. 如果有未检查的，先检查
    if (containersToCheck.length > 0) {
      setCheckingAll(true);
      try {
        const idsToCheck = containersToCheck.map(c => c.Id);
        // 设置临时状态
        setUpdateStatus(prev => {
          const next = new Map(prev);
          idsToCheck.forEach(id => next.set(id, 'checking'));
          return next;
        });

        const response = await axios.post('/api/containers/check-update/batch', { ids: idsToCheck });
        const results = response.data;

        setUpdateStatus(prev => {
          const next = new Map(prev);
          Object.entries(results).forEach(([id, result]) => {
            const status = result.status || (result.hasUpdate ? 'available' : 'latest');
            next.set(id, status);
            if (status === 'available') {
              const container = containers.find(c => c.Id === id);
              if (container) containersToUpdate.push(container);
            }
          });
          return next;
        });
      } catch (e) {
        console.error('Batch check failed during update all:', e);
      } finally {
        setCheckingAll(false);
      }
    }

    if (containersToUpdate.length === 0) {
      alert('所有容器已是最新版本');
      return;
    }

    // 3. 准备数据并开始更新
    try {
      const updateList = [];
      for (const container of containersToUpdate) {
        const data = await prepareContainerData(container.Id);
        updateList.push(data);
      }
      setUpdateContainersList(updateList);
      setShowUpdateProgress(true);
    } catch (error) {
      alert(`准备批量更新失败: ${error.message}`);
    }
  };

  const handleAction = async (container, action, data = {}) => {
    try {
      await axios.post(`/api/containers/${container.Id}/${action}`, data);
      setClickedContainer(null);
      fetchContainers();
    } catch (error) {
      console.error(`Failed to ${action} container:`, error);
      alert(`操作失败: ${error.message}`);
    }
  };

  const handleBulkAction = async (action) => {
    const targetContainers = action === 'start'
      ? containers.filter(c => c.State === 'exited' && !c.Image.includes('wudiming/dma'))
      : containers.filter(c => c.State === 'running' && !c.Image.includes('wudiming/dma'));

    if (targetContainers.length === 0) {
      alert('没有可操作的容器');
      return;
    }

    for (const container of targetContainers) {
      try {
        await axios.post(`/api/containers/${container.Id}/${action}`);
      } catch (error) {
        console.error(`Failed to ${action} container ${container.Names[0]}:`, error);
      }
    }
    fetchContainers();
  };

  const handleShowLogs = (container) => {
    setSelectedContainer(container);
    setShowLogs(true);
    setClickedContainer(null);
  };

  const handleShowUpdate = async (containerSummary) => {
    try {
      // 获取完整容器详情以确保 HostConfig 等字段存在
      const response = await axios.get(`/api/containers/${containerSummary.Id}`);
      const container = response.data;

      // 准备初始数据
      const initialData = {
        containerId: container.Id,
        name: container.Name?.replace(/^\//, '') || '',
        image: container.Config?.Image || containerSummary.Image,
        // 端口处理：将 PortBindings 转换为数组
        ports: container.HostConfig?.PortBindings ? Object.entries(container.HostConfig.PortBindings).map(([containerPort, hostBindings]) => {
          const port = containerPort.split('/')[0];
          const hostPort = hostBindings && hostBindings[0] ? hostBindings[0].HostPort : '';
          return hostPort ? `${hostPort}:${port}` : port;
        }) : [],
        // 卷处理
        volumes: container.Mounts?.map(m =>
          `${m.Source ? m.Source : m.Name}:${m.Destination}`
        ) || [],
        // 环境变量
        env: container.Config?.Env || [],
        restart: container.HostConfig?.RestartPolicy?.Name || 'no',
        network: container.HostConfig?.NetworkMode || 'bridge',
        iconUrl: container.Config?.Labels?.['ICON_URL'] || '',
        webUi: container.Config?.Labels?.['WEBUI_URL'] || ''
      };

      setUpdateContainer(initialData);
      setShowCreateModal(true);
      setClickedContainer(null);
    } catch (error) {
      console.error('Failed to fetch container details:', error);
      alert('获取容器详情失败，无法编辑');
    }
  };

  const handleShowTerminal = (container) => {
    setTerminalContainer(container);
    setShowTerminal(true);
    setClickedContainer(null);
  };

  const handleIconClick = (containerId) => {
    setClickedContainer(clickedContainer === containerId ? null : containerId);
  };

  const handleLogout = () => {
    localStorage.removeItem('dma_token');
    navigate('/login');
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
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
          <NavItem icon={<Container />} label={t('nav.containers')} active isDark={isDark} />
          <NavItem icon={<Boxes />} label={t('nav.stacks')} onClick={() => navigate('/stacks')} isDark={isDark} />
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
            退出
          </button>
        </div>
      </aside>

      <main className="ml-72 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('nav.containers')}
            </h1>
            <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('dashboard.total')} {containers.length} {t('nav.containers')}
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
              <span>{t('container.create')}</span>
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

        {/* 批量操作按钮 */}
        <div className={`mb-6 p-4 rounded-lg ${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} border`}>
          <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {t('container.batch_actions')}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBulkAction('start')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isDark ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
            >
              <Play className="w-4 h-4 inline mr-1" />
              {t('container.start_all')}
            </button>
            <button
              onClick={() => handleBulkAction('stop')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isDark ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
            >
              <Square className="w-4 h-4 inline mr-1" />
              {t('container.stop_all')}
            </button>
            <button
              onClick={() => handleBulkAction('restart')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isDark ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
            >
              <RotateCw className="w-4 h-4 inline mr-1" />
              {t('container.restart_all')}
            </button>
            <button
              onClick={checkAllUpdates}
              disabled={checkingAll}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isDark ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'} disabled:opacity-50`}
            >
              {checkingAll ? <Loader2 className="w-4 h-4 inline mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 inline mr-1" />}
              {t('container.check_updates')}
            </button>
            <button
              onClick={updateAllContainers}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isDark ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'}`}
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              {t('container.update_all')}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {containers.length === 0 ? (
            <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-xl p-12 border text-center`}>
              <Container className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('container.no_containers')}</h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('container.no_containers_desc')}
              </p>
            </div>
          ) : (
            containers.map((container) => (
              <UnraidContainerCard
                key={container.Id}
                container={container}
                isDark={isDark}
                stats={containerStats.get(container.Id)}
                updateStatus={updateStatus.get(container.Id)}
                updateError={updateErrors.get(container.Id)}
                isMenuOpen={clickedContainer === container.Id}
                onIconClick={() => handleIconClick(container.Id)}
                handleAction={handleAction}
                handleShowLogs={handleShowLogs}
                handleShowUpdate={handleShowUpdate}
                handleShowTerminal={handleShowTerminal}
                images={images} // Pass images to card

                checkUpdate={() => checkSingleUpdate(container.Id)}
                updateContainer={() => updateSingleContainer(container.Id)}
                menuRef={clickedContainer === container.Id ? menuRef : null}
                onDeleteClick={(container) => setDeleteModal({ show: true, container })}
              />
            ))
          )}
        </div>
      </main >

      {showLogs && selectedContainer && (
        <ContainerLogs
          container={selectedContainer}
          isDark={isDark}
          onClose={() => setShowLogs(false)}
        />
      )
      }

      {
        showCreateModal && (
          <CreateContainerModal
            isDark={isDark}
            images={images}
            onClose={() => {
              setShowCreateModal(false);
              setUpdateContainer(null); // 清除编辑状态
            }}
            onSuccess={fetchContainers}
            initialData={updateContainer} // 传递初始数据
          />
        )
      }

      {/* UpdateContainerModal 已移除，使用 CreateContainerModal 代替 */}

      {
        showTerminal && terminalContainer && (
          <ContainerTerminal
            container={terminalContainer}
            isDark={isDark}
            onClose={() => setShowTerminal(false)}
          />
        )
      }

      {showUpdateProgress && (
        <ErrorBoundary onClose={() => setShowUpdateProgress(false)}>
          <UpdateProgressDialog
            isDark={isDark}
            containers={updateContainersList}
            onClose={() => {
              setShowUpdateProgress(false);
              fetchContainers();
            }}
            onSuccess={() => {
              fetchContainers();
            }}
          />
        </ErrorBoundary>
      )}

      {deleteModal.show && deleteModal.container && (
        <DeleteConfirmModal
          isDark={isDark}
          container={deleteModal.container}
          onClose={() => setDeleteModal({ show: false, container: null })}
          onConfirm={(deleteImage) => {
            handleAction(deleteModal.container, 'remove', { deleteImage });
            setDeleteModal({ show: false, container: null });
          }}
        />
      )}
    </div >
  );
}

// 三点加载动画
const ThreeDotsLoader = ({ isDark }) => (
  <div className="flex space-x-1 justify-center items-center h-6">
    <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-gray-500' : 'bg-gray-400'} animate-bounce [animation-delay:-0.3s]`}></div>
    <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-gray-500' : 'bg-gray-400'} animate-bounce [animation-delay:-0.15s]`}></div>
    <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-gray-500' : 'bg-gray-400'} animate-bounce`}></div>
  </div>
);

// Unraid风格容器卡片
function UnraidContainerCard({
  container,
  isDark,
  stats,
  updateStatus,
  updateError,
  isMenuOpen,
  onIconClick,
  handleAction,
  handleShowLogs,
  handleShowUpdate,
  handleShowTerminal,
  images, // Receive images prop

  checkUpdate,
  updateContainer,
  menuRef,
  onDeleteClick
}) {
  const { t } = useTranslation();
  const isRunning = container.State === 'running';
  const isPaused = container.State === 'paused';
  const isStopped = container.State === 'exited';

  const getStatusColor = () => {
    if (isRunning) return 'bg-green-500';
    if (isPaused) return 'bg-yellow-500';
    if (isStopped) return 'bg-gray-500';
    return 'bg-red-500';
  };

  const containerName = container.Names[0]?.replace(/^\//, '') || container.Id.substring(0, 12);

  // Resolve image name
  let imageName = container.Image;
  if (imageName.startsWith('sha256:') && images) {
    const foundImage = images.find(img => img.Id === imageName);
    if (foundImage && foundImage.RepoTags && foundImage.RepoTags.length > 0) {
      // Prefer 'latest' tag if available
      const latestTag = foundImage.RepoTags.find(tag => tag.endsWith(':latest'));
      imageName = latestTag || foundImage.RepoTags[0];
    }
  }

  // 网络信息
  const networks = Object.keys(container.NetworkSettings?.Networks || {});
  const networkName = networks[0] || '-';
  const ipAddress = container.NetworkSettings?.Networks?.[networks[0]]?.IPAddress || '-';

  // 端口信息
  const ports = [...new Set(container.Ports?.map(p =>
    p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}`
  ))].join(', ') || '-';

  // 卷映射信息
  const volumes = container.Mounts?.map(m =>
    `${m.Source ? m.Source.split('/').pop() : m.Name}:${m.Destination}`
  ).join(', ') || '-';



  // 检查是否有WebUI参数 - 仅当存在 WEBUI_URL 标签时显示
  const webUiLabel = container.Labels?.['WEBUI_URL'];
  const hasWebUI = !!webUiLabel;

  // 构建 WebUI URL
  let webUIUrl = null;
  if (webUiLabel) {
    // 获取当前主机名 (如果是远程节点，应该使用节点IP，但这里我们只能获取到浏览器访问的地址)
    // 理想情况下应该从 endpoint context 获取 host，但这里简化处理
    const currentHost = window.location.hostname;

    if (webUiLabel.includes('://')) {
      webUIUrl = webUiLabel;
    } else if (/^\d+$/.test(webUiLabel)) {
      // 纯数字，视为端口
      webUIUrl = `http://${currentHost}:${webUiLabel}`;
    } else if (webUiLabel.startsWith(':')) {
      // :端口 格式
      webUIUrl = `http://${currentHost}${webUiLabel}`;
    } else {
      // 默认为 http
      webUIUrl = `http://${webUiLabel}`;
    }

    // 替换 [IP] 占位符
    if (webUIUrl.includes('[IP]')) {
      webUIUrl = webUIUrl.replace('[IP]', currentHost);
    }
    console.log(`[WebUI] Container: ${container.Names[0]}, Label: ${webUiLabel}, Host: ${currentHost}, Result: ${webUIUrl}`);
  }

  // 自定义图标（通过label）
  const customIcon = container.Labels?.['ICON_URL'];

  const navigate = useNavigate();
  const isStack = container.Labels && (container.Labels['com.docker.compose.project'] || container.Labels['com.docker.stack.namespace']);

  const [menuPosition, setMenuPosition] = React.useState('top');
  const buttonRef = React.useRef(null); // 新增：引用按钮元素

  React.useEffect(() => {
    if (isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;

      // 统一使用相同的定位逻辑 (优先向下，空间不足向上)
      if (spaceBelow < 250) {
        setMenuPosition('bottom');
      } else {
        setMenuPosition('top');
      }
    }
  }, [isMenuOpen]);

  return (
    <div className={`${isDark ? 'glass border-white/10' : 'bg-white border-gray-200 shadow-sm'} rounded-lg p-4 border transition-all hover:shadow-lg relative ${isMenuOpen ? 'z-20' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Unraid风格：左侧大图标 + 点击菜单 */}
        <div className="relative flex-shrink-0">
          <div
            ref={buttonRef} // 绑定 ref 到按钮
            onClick={onIconClick}
            className={`w-16 h-16 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-gray-100'} cursor-pointer transition-all hover:scale-105 ${isMenuOpen ? 'ring-2 ring-cyan-400' : ''} overflow-hidden`}
          >
            {customIcon ? (
              <img src={customIcon} alt={containerName} className="w-full h-full object-cover" />
            ) : (
              <Container className={`w-10 h-10 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            )}
          </div>
          {/* 状态指示器 */}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${getStatusColor()} border-2 ${isDark ? 'border-gray-900' : 'border-white'} shadow-lg`}></div>

          {isMenuOpen && (
            <div
              ref={menuRef}
              style={{
                top: menuPosition === 'top' ? '0' : 'auto',
                bottom: menuPosition === 'bottom' ? '0' : 'auto'
              }}
              className={`absolute left-full ml-2 w-56 ${isDark ? 'glass-menu-dark' : 'glass-menu-light'} rounded-lg overflow-hidden z-[100] animate-in fade-in slide-in-from-left-2 duration-200`}
            >
              {hasWebUI && webUIUrl && isRunning && (
                <>
                  <UnraidMenuItem
                    icon={<ExternalLink className="w-4 h-4" />}
                    label={t('container.open_webui')}
                    onClick={() => {
                      window.open(webUIUrl, '_blank');
                      onIconClick(); // Close menu
                    }}
                    isDark={isDark}
                  />
                  <UnraidMenuDivider isDark={isDark} />
                </>
              )}

              {isRunning && (
                <UnraidMenuItem
                  icon={<Terminal className="w-4 h-4" />}
                  label={t('container.shell')}
                  onClick={() => {
                    handleShowTerminal(container);
                    onIconClick(); // Close menu
                  }}
                  isDark={isDark}
                />
              )}

              {!isStack && (
                <>
                  <UnraidMenuDivider isDark={isDark} />

                  {!isRunning && !isPaused && (
                    <UnraidMenuItem
                      icon={<Play className="w-4 h-4" />}
                      label={t('container.start')}
                      onClick={() => {
                        handleAction(container, 'start');
                        onIconClick(); // Close menu
                      }}
                      isDark={isDark}
                    />
                  )}
                  {isRunning && (
                    <UnraidMenuItem
                      icon={<Square className="w-4 h-4" />}
                      label={t('container.stop')}
                      onClick={() => {
                        handleAction(container, 'stop');
                        onIconClick(); // Close menu
                      }}
                      isDark={isDark}
                    />
                  )}
                  {isRunning && (
                    <UnraidMenuItem
                      icon={<Pause className="w-4 h-4" />}
                      label={t('container.pause')}
                      onClick={() => {
                        handleAction(container, 'pause');
                        onIconClick(); // Close menu
                      }}
                      isDark={isDark}
                    />
                  )}
                  {isPaused && (
                    <UnraidMenuItem
                      icon={<PlayCircle className="w-4 h-4" />}
                      label={t('container.resume')}
                      onClick={() => {
                        handleAction(container, 'unpause');
                        onIconClick(); // Close menu
                      }}
                      isDark={isDark}
                    />
                  )}
                  <UnraidMenuItem
                    icon={<RotateCw className="w-4 h-4" />}
                    label={t('container.restart')}
                    onClick={() => {
                      handleAction(container, 'restart');
                      onIconClick(); // Close menu
                    }}
                    isDark={isDark}
                  />
                </>
              )}

              <UnraidMenuDivider isDark={isDark} />

              <UnraidMenuItem
                icon={<FileText className="w-4 h-4" />}
                label={t('container.logs')}
                onClick={() => {
                  handleShowLogs(container);
                  onIconClick(); // Close menu
                }}
                isDark={isDark}
              />

              {!isStack && (
                <>
                  <UnraidMenuItem
                    icon={<Edit className="w-4 h-4" />}
                    label={t('common.edit')}
                    onClick={() => {
                      handleShowUpdate(container);
                      onIconClick(); // Close menu
                    }}
                    isDark={isDark}
                  />
                  <UnraidMenuItem
                    icon={<Trash2 className="w-4 h-4" />}
                    label={t('common.remove')}
                    onClick={() => {
                      onDeleteClick(container);
                      onIconClick(); // Close menu
                    }}
                    isDark={isDark}
                    danger
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* 容器详细信息 */}
        <div className="flex-1 min-w-0">
          {/* 第一行：名称 + 镜像 + 版本状态 */}
          <div className="flex items-center gap-3 mb-3">
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {containerName}
            </h3>
            <div className="flex items-center gap-2">
              <Image className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{imageName}</span>
            </div>

            {/* 版本状态 - 紧跟镜像后 */}
            {updateStatus === 'checking' && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{t('container.checking')}</span>
              </div>
            )}
            {updateStatus === 'latest' && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  checkUpdate();
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${isDark ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                title="点击重新检查更新"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>{t('container.up_to_date')}</span>
              </div>
            )}
            {updateStatus === 'available' && (
              <button
                onClick={isStack ? () => {
                  localStorage.setItem('dma_stacks_active_tab', 'stacks');
                  navigate('/stacks');
                } : updateContainer}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all ${isDark ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
              >
                {isStack ? <Boxes className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                <span>{isStack ? t('container.stack_update') : t('common.update')}</span>
              </button>
            )}
            {updateStatus === 'updating' && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{t('container.updating')}</span>
              </div>
            )}
            {updateStatus === 'local' && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-500/10 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                <HardDrive className="w-3 h-3" />
                <span>{t('container.local')}</span>
              </div>
            )}
            {updateStatus === 'error' && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  checkUpdate();
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                title={updateError || "检查失败，点击重试"}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>失败 (点击重试)</span>
              </div>
            )}
          </div>

          {/* 第二行：网络IP、端口、卷 */}
          <div className={`grid grid-cols-3 gap-x-6 gap-y-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <div className="flex items-center gap-2">
              <Wifi className="w-3 h-3" />
              <span className="truncate">{networkName}: {ipAddress}</span>
            </div>
            <div className="flex items-center gap-2">
              <Network className="w-3 h-3" />
              <span className="truncate">{t('container.ports')}: {ports}</span>
            </div>
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3 h-3" />
              <span className="truncate">{t('container.volumes')}: {volumes}</span>
            </div>
          </div>
        </div>

        {/* 右侧：CPU/内存 - 固定宽度防止抖动 */}
        <div className="flex items-center justify-end" style={{ width: '280px' }}>
          {/* 实时资源监控 */}
          {isRunning ? (
            <div className={`flex gap-3 px-3 py-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`} style={{ width: '210px' }}>
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('container.cpu')}</span>
                </div>
                <div className="text-base font-bold text-blue-400 text-center" style={{ width: '70px', display: 'inline-block' }}>
                  {stats ? `${stats.cpu.percent}%` : <ThreeDotsLoader isDark={isDark} />}
                </div>
              </div>
              <div className={`w-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}></div>
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <HardDriveIcon className="w-4 h-4 text-purple-400" />
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('container.memory')}</span>
                </div>
                <div className="text-base font-bold text-purple-400 text-center" style={{ width: '90px', display: 'inline-block' }}>
                  {stats ? stats.memory.usageFormatted : <ThreeDotsLoader isDark={isDark} />}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ width: '210px' }}></div>
          )}
        </div>
      </div>



    </div>
  );
}

function DeleteConfirmModal({ isDark, container, onClose, onConfirm }) {
  const { t } = useTranslation();
  const [deleteImage, setDeleteImage] = useState(false);
  const containerName = container.Names[0]?.replace(/^\//, '') || container.Id.substring(0, 12);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${isDark ? 'glass border-white/20' : 'bg-white border-gray-200'} rounded-xl w-full max-w-md border shadow-2xl p-6`}>
        <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('container.delete_modal_title')}
        </h3>
        <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          {t('container.delete_modal_content', { name: containerName })}
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
              {t('container.delete_with_image')}
            </div>
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('container.delete_with_image_desc')}
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
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
// Unraid菜单项组件
function UnraidMenuItem({ icon, label, onClick, isDark, disabled = false, danger = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all text-left ${disabled
        ? 'opacity-50 cursor-not-allowed'
        : danger
          ? isDark
            ? 'hover:bg-red-500/10 text-red-400'
            : 'hover:bg-red-50 text-red-600'
          : isDark
            ? 'hover:bg-white/5 text-gray-300'
            : 'hover:bg-gray-50 text-gray-700'
        }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

// 分割线
function UnraidMenuDivider({ isDark }) {
  return <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}></div>;
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

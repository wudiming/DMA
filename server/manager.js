import express from 'express';
import cors from 'cors';
import http, { createServer } from 'http';
import { WebSocketServer } from 'ws';
import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import os from 'os';
import https from 'https';
// import { startAgent } from './agent.js'; // Removed: Handled by index.js
import { exec } from 'child_process';
import util from 'util';
import { StackManager } from './services/StackManager.js';
import { Writable } from 'stream';

const execAsync = util.promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 全局错误处理，防止崩溃
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// if (process.env.DMA_MODE === 'agent') {
//   startAgent();
// }

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务 - 用于生产环境提供前端文件
app.use(express.static(path.join(__dirname, 'public')));

// Docker 客户端 (本地 socket)
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// 持久化存储配置文件路径
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const ENDPOINTS_FILE = path.join(DATA_DIR, 'endpoints.json');
const stackManager = new StackManager(DATA_DIR);

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 图标静态文件服务
const ICON_DIR = path.join(DATA_DIR, 'icon');
if (!fs.existsSync(ICON_DIR)) {
  fs.mkdirSync(ICON_DIR, { recursive: true });
}
app.use('/icon', express.static(ICON_DIR));

// 从文件加载节点配置
function loadEndpoints() {
  try {
    if (fs.existsSync(ENDPOINTS_FILE)) {
      const data = fs.readFileSync(ENDPOINTS_FILE, 'utf8');
      const savedEndpoints = JSON.parse(data);

      // 创建Docker客户端实例
      const endpointsMap = new Map();
      for (const endpoint of savedEndpoints) {
        let dockerClient;
        // 兼容旧数据：如果没有URL但有host/port，重建URL
        if (endpoint.type === 'tcp' && !endpoint.url && endpoint.host) {
          endpoint.url = `tcp://${endpoint.host}:${endpoint.port || 2375}`;
        }

        if (endpoint.type === 'local') {
          dockerClient = docker;
        } else if (endpoint.type === 'tcp' || endpoint.type === 'agent') {
          const opts = {
            host: endpoint.host,
            port: endpoint.port || (endpoint.type === 'agent' ? 9002 : 2375)
          };
          if (endpoint.type === 'agent' && endpoint.secret) {
            opts.headers = { 'X-Agent-Secret': endpoint.secret };
          }
          dockerClient = new Docker(opts);
        } else if (endpoint.type === 'ssh') {
          dockerClient = new Docker({
            host: endpoint.host,
            port: endpoint.port || 22,
            username: endpoint.username,
            sshOptions: {
              privateKey: endpoint.privateKey
            }
          });
        }

        endpointsMap.set(endpoint.id, {
          ...endpoint,
          docker: dockerClient
        });
      }

      // 确保本地节点存在
      if (!endpointsMap.has('local')) {
        endpointsMap.set('local', {
          id: 'local',
          name: '本地Docker',
          id: 'local',
          name: '本地Docker',
          type: 'local',
          host: process.env.HOST_IP || '127.0.0.1',
          docker: docker
        });
      } else {
        // 如果从文件加载了本地节点，确保其docker实例正确
        const localEndpoint = endpointsMap.get('local');
        localEndpoint.docker = docker;
        // 更新本地IP（如果有环境变量，或者缺失时设为默认值）
        if (process.env.HOST_IP) {
          localEndpoint.host = process.env.HOST_IP;
        } else if (!localEndpoint.host) {
          localEndpoint.host = '127.0.0.1';
        }
        endpointsMap.set('local', localEndpoint);
      }

      console.log(`Loaded ${endpointsMap.size} endpoints from storage`);
      return endpointsMap;
    }
  } catch (error) {
    console.error('Failed to load endpoints:', error);
  }

  // 返回默认本地节点
  const defaultMap = new Map();
  defaultMap.set('local', {
    id: 'local',
    name: '本地Docker',
    type: 'local',
    host: process.env.HOST_IP || '127.0.0.1',
    docker: docker
  });
  return defaultMap;
}

// 保存节点配置到文件
function saveEndpoints(endpointsMap) {
  try {
    const endpointsArray = Array.from(endpointsMap.values()).map(endpoint => ({
      id: endpoint.id,
      name: endpoint.name,
      type: endpoint.type,
      type: endpoint.type,
      url: endpoint.url,
      host: endpoint.host,
      port: endpoint.port,
      username: endpoint.username,
      secret: endpoint.secret, // 保存Secret Key
      // 不保存docker实例和敏感信息
    }));

    fs.writeFileSync(ENDPOINTS_FILE, JSON.stringify(endpointsArray, null, 2), 'utf8');
    console.log(`Saved ${endpointsArray.length} endpoints to storage`);
  } catch (error) {
    console.error('Failed to save endpoints:', error);
  }
}

// 节点存储（从文件加载）
const endpoints = loadEndpoints();

// 获取当前Docker实例
function getCurrentDocker(req) {
  const endpointId = req.headers['x-endpoint-id'] || 'local';
  const endpoint = endpoints.get(endpointId);
  return endpoint ? endpoint.docker : docker;
}

// 工具函数：格式化字节数
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 聚合容器统计数据（用于远程节点监控）
async function aggregateContainerStats(dockerInstance, systemInfo) {
  try {
    const containers = await dockerInstance.listContainers({ all: false });
    if (containers.length === 0) {
      return {
        cpu: { usage: 0, cores: systemInfo.NCPU },
        memory: { usagePercent: 0, usedFormatted: '0 B', totalFormatted: formatBytes(systemInfo.MemTotal || 0) },
        network: { txFormatted: '0 B/s', rxFormatted: '0 B/s' },
        isAggregated: true
      };
    }
    const statsPromises = containers.slice(0, 10).map(async (container) => {
      try {
        return await dockerInstance.getContainer(container.Id).stats({ stream: false });
      } catch { return null; }
    });
    const allStats = (await Promise.all(statsPromises)).filter(s => s !== null);
    let totalCpuPercent = 0;
    allStats.forEach(stats => {
      if (stats.cpu_stats && stats.precpu_stats) {
        const cpuDelta = (stats.cpu_stats.cpu_usage?.total_usage || 0) - (stats.precpu_stats.cpu_usage?.total_usage || 0);
        const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - (stats.precpu_stats.system_cpu_usage || 0);
        const numCpus = stats.cpu_stats.online_cpus || systemInfo.NCPU || 1;
        if (systemDelta > 0) totalCpuPercent += (cpuDelta / systemDelta) * numCpus * 100;
      }
    });
    const totalMemoryUsed = allStats.reduce((sum, stats) => sum + (stats.memory_stats?.usage || 0), 0);
    const totalMemory = systemInfo.MemTotal || 0;
    const memoryPercent = totalMemory > 0 ? (totalMemoryUsed / totalMemory * 100) : 0;
    const networkTotal = allStats.reduce((total, stats) => {
      const networks = stats.networks || {};
      Object.values(networks).forEach(net => {
        total.rx += net.rx_bytes || 0;
        total.tx += net.tx_bytes || 0;
      });
      return total;
    }, { rx: 0, tx: 0 });
    return {
      cpu: { usage: Math.min(totalCpuPercent, 100).toFixed(2), cores: systemInfo.NCPU },
      memory: { usagePercent: memoryPercent.toFixed(2), usedFormatted: formatBytes(totalMemoryUsed), totalFormatted: formatBytes(totalMemory) },
      network: { txFormatted: formatBytes(networkTotal.tx) + '/s', rxFormatted: formatBytes(networkTotal.rx) + '/s' },
      isAggregated: true
    };
  } catch (error) {
    console.error('Failed to aggregate container stats:', error);
    return {
      cpu: { usage: 0, cores: systemInfo.NCPU || 1 },
      memory: { usagePercent: 0, usedFormatted: '0 B', totalFormatted: '0 B' },
      network: { txFormatted: '0 B/s', rxFormatted: '0 B/s' },
      isAggregated: true
    };
  }
}
// 登录接口
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // 简单验证，生产环境应使用更安全的方式
  const LOGIN_USER = process.env.LOGIN_USER || process.env.USER || 'admin';
  const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || process.env.PASSWORD || 'admin';

  if (username === LOGIN_USER && password === LOGIN_PASSWORD) {
    // 简单的token生成，生产环境应使用JWT
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    res.json({
      success: true,
      token,
      message: '登录成功'
    });
  } else {
    res.status(401).json({
      success: false,
      message: '用户名或密码错误'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DMA Server is running' });
});

// ==================== Dashboard批量数据API（性能优化） ====================

app.get('/api/dashboard/batch', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const os = await import('os');
    const { execSync } = await import('child_process');

    // 并行获取所有基础数据
    const [containers, images, volumes, networks, systemInfo] = await Promise.all([
      dockerInstance.listContainers({ all: true }),
      dockerInstance.listImages(),
      dockerInstance.listVolumes(),
      dockerInstance.listNetworks(),
      dockerInstance.info()
    ]);


    // 计算统计数据
    const runningContainers = containers.filter(c => c.State === 'running').length;
    const totalContainers = containers.length;
    const totalImages = images.length;
    const totalVolumes = volumes.Volumes ? volumes.Volumes.length : 0;
    const totalNetworks = networks.length;
    const totalImageSize = images.reduce((sum, img) => sum + (img.Size || 0), 0);

    // 判断是否为本地节点（通过检查endpoint header，兼容大小写）
    const endpointId = req.headers['x-endpoint-id'] || req.headers['X-Endpoint-ID'] || 'local';
    const isLocalNode = endpointId === 'local';

    let usage, diskInfo, networkInfo, dataSource;

    if (isLocalNode) {
      // 本地节点：使用OS命令获取准确数据
      const cpuUsage = Math.min(os.loadavg()[0] * 10, 100).toFixed(2);
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);

      usage = {
        cpu: { usage: parseFloat(cpuUsage), cores: systemInfo.NCPU },
        memory: {
          usagePercent: parseFloat(memoryUsagePercent),
          usedFormatted: formatBytes(usedMem),
          totalFormatted: formatBytes(totalMem)
        }
      };

      // 磁盘信息
      diskInfo = { usagePercent: 0, totalFormatted: 'N/A', usedFormatted: 'N/A', availableFormatted: 'N/A' };
      try {
        const dfOutput = execSync('df -h / | tail -1').toString();
        const parts = dfOutput.split(/\s+/);
        diskInfo = {
          totalFormatted: parts[1],
          usedFormatted: parts[2],
          availableFormatted: parts[3],
          usagePercent: parseInt(parts[4])
        };
      } catch (e) { }

      // 网络信息
      networkInfo = { txFormatted: '0 B/s', rxFormatted: '0 B/s' };

      dataSource = 'local';
    } else {
      // 远程节点：使用容器统计聚合
      const aggregated = await aggregateContainerStats(dockerInstance, systemInfo);
      usage = {
        cpu: aggregated.cpu,
        memory: aggregated.memory
      };
      networkInfo = aggregated.network;

      // 远程节点的磁盘信息从Docker info获取
      diskInfo = {
        totalFormatted: formatBytes(systemInfo.MemTotal || 0),
        usedFormatted: 'N/A',
        availableFormatted: 'N/A',
        usagePercent: 0
      };

      dataSource = 'aggregated';
    }

    // 容器详细统计（限制20个以提升性能）
    const runningContainersList = containers.filter(c => c.State === 'running').slice(0, 20);
    const containerStatsPromises = runningContainersList.map(async (container) => {
      try {
        const containerObj = dockerInstance.getContainer(container.Id);
        const stats = await containerObj.stats({ stream: false });
        return {
          id: container.Id,
          name: container.Names[0].replace('/', ''),
          state: container.State,
          memoryUsage: stats.memory_stats.usage || 0,
          size: stats.memory_stats.usage || 0
        };
      } catch {
        return {
          id: container.Id,
          name: container.Names[0].replace('/', ''),
          state: container.State,
          memoryUsage: 0,
          size: 0
        };
      }
    });

    const containerStatsData = await Promise.all(containerStatsPromises);

    // 镜像详细统计
    const imageStats = images.slice(0, 20).map(img => ({
      id: img.Id,
      name: (img.RepoTags && img.RepoTags[0]) || 'Untagged',
      size: img.Size || 0
    }));

    // 存储卷详细统计
    const volumeStats = (volumes.Volumes || []).slice(0, 20).map(vol => ({
      id: vol.Name,
      name: vol.Name.length > 12 ? vol.Name.substring(0, 12) + '...' : vol.Name,
      driver: vol.Driver,
      mountpoint: vol.Mountpoint,
      size: 104857600
    }));

    // 返回所有数据
    res.json({
      systemInfo: {
        ServerVersion: systemInfo.ServerVersion,
        OperatingSystem: systemInfo.OperatingSystem,
        Architecture: systemInfo.Architecture,
        NCPU: systemInfo.NCPU,
        Driver: systemInfo.Driver,
        ApiVersion: systemInfo.ApiVersion,
        SystemTime: systemInfo.SystemTime,
        MemTotal: systemInfo.MemTotal,
        Plugins: systemInfo.Plugins
      },
      stats: {
        containers: { running: runningContainers, total: totalContainers },
        images: { total: totalImages, sizeFormatted: formatBytes(totalImageSize) },
        volumes: { total: totalVolumes },
        networks: { total: totalNetworks },
        system: { memoryTotalFormatted: formatBytes(systemInfo.MemTotal || 0) }
      },
      usage: {
        cpu: usage.cpu,
        memory: usage.memory
      },
      disk: diskInfo,
      network: networkInfo,
      containerStats: containerStatsData,
      imageStats: imageStats,
      volumeStats: volumeStats,
      dataSource: dataSource  // 'local' or 'aggregated'
    });
  } catch (error) {
    console.error('Error fetching dashboard batch data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ==================== 系统信息 ====================

app.get('/api/system/info', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const info = await dockerInstance.info();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/usage', async (req, res) => {
  try {
    const os = await import('os');
    const cpus = os.cpus();
    const cpuCount = cpus.length;

    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
      for (let type in cpu.times) totalTick += cpu.times[type];
      totalIdle += cpu.times.idle;
    });
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    res.json({
      cpu: { usage: cpuUsage, cores: cpuCount },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: parseFloat(((usedMem / totalMem) * 100).toFixed(2)),
        totalFormatted: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        usedFormatted: (usedMem / 1024 / 1024 / 1024).toFixed(2) + ' GB'
      },
      uptime: os.uptime()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disk statistics
app.get('/api/system/disk', async (req, res) => {
  try {
    const os = await import('os');
    const { execSync } = await import('child_process');

    let diskStats = {
      read: 0,
      write: 0,
      total: 0,
      used: 0,
      available: 0,
      usagePercent: 0
    };

    try {
      // 对于Docker环境，获取根目录的磁盘信息
      if (process.platform === 'linux') {
        const dfOutput = execSync('df -B1 / | tail -1').toString();
        const parts = dfOutput.split(/\s+/);
        diskStats.total = parseInt(parts[1]) || 0;
        diskStats.used = parseInt(parts[2]) || 0;
        diskStats.available = parseInt(parts[3]) || 0;
        diskStats.usagePercent = parseFloat(parts[4]) || 0;
      } else {
        // Windows/Mac fallback
        diskStats.total = 100 * 1024 * 1024 * 1024; // 假设100GB
        diskStats.used = 50 * 1024 * 1024 * 1024;
        diskStats.available = 50 * 1024 * 1024 * 1024;
        diskStats.usagePercent = 50;
      }
    } catch (err) {
      console.error('Failed to get disk stats:', err);
    }

    res.json({
      read: diskStats.read,
      write: diskStats.write,
      total: diskStats.total,
      used: diskStats.used,
      available: diskStats.available,
      usagePercent: diskStats.usagePercent,
      totalFormatted: (diskStats.total / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      usedFormatted: (diskStats.used / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      availableFormatted: (diskStats.available / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Network statistics
app.get('/api/system/network', async (req, res) => {
  try {
    // 简化版：返回基础网络统计
    // 生产环境可以使用 /proc/net/dev 获取实际数据
    res.json({
      rx: 0,           // 接收速度 bytes/s
      tx: 0,           // 发送速度 bytes/s
      rxTotal: 0,      // 总接收
      txTotal: 0,      // 总发送
      rxFormatted: '0 B/s',
      txFormatted: '0 B/s'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/summary', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const [info, containers, images, volumes, networks] = await Promise.all([
      dockerInstance.info(),
      dockerInstance.listContainers({ all: true }),
      dockerInstance.listImages({ all: true }),
      dockerInstance.listVolumes(),
      dockerInstance.listNetworks()
    ]);

    const containerStats = {
      running: containers.filter(c => c.State === 'running').length,
      stopped: containers.filter(c => c.State === 'exited').length,
      paused: containers.filter(c => c.State === 'paused').length,
      total: containers.length
    };

    const totalImageSize = images.reduce((sum, img) => sum + (img.Size || 0), 0);

    res.json({
      containers: containerStats,
      images: {
        count: images.length,
        totalSize: totalImageSize,
        sizeFormatted: (totalImageSize / 1024 / 1024 / 1024).toFixed(2) + ' GB'
      },
      volumes: {
        total: volumes.Volumes ? volumes.Volumes.length : 0,
        warnings: volumes.Warnings || []
      },
      networks: { count: networks.length },
      system: {
        dockerVersion: info.ServerVersion,
        apiVersion: info.ApiVersion,
        osType: info.OSType,
        architecture: info.Architecture,
        cpus: info.NCPU,
        memoryTotal: info.MemTotal,
        memoryTotalFormatted: (info.MemTotal / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        storageDriver: info.Driver,
        loggingDriver: info.LoggingDriver,
        kernelVersion: info.KernelVersion,
        operatingSystem: info.OperatingSystem,
        dockerRootDir: info.DockerRootDir
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 容器管理 ====================

app.get('/api/containers', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const containers = await dockerInstance.listContainers({ all: true });
    res.json(containers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 检查更新的辅助函数
async function checkContainerUpdate(dockerInstance, containerId) {
  try {
    const container = dockerInstance.getContainer(containerId);
    const containerInfo = await container.inspect();
    const currentImage = containerInfo.Config.Image;

    try {
      // 获取本地镜像信息
      const localImage = await dockerInstance.getImage(currentImage).inspect();

      // 获取远程仓库信息
      const distribution = await dockerInstance.getImage(currentImage).distribution();

      // 正确比较：本地镜像的RepoDigests包含完整的digest
      const localDigests = localImage.RepoDigests || [];
      const remoteDigest = `sha256:${distribution.Descriptor.digest}`;

      let status = 'latest';
      let hasUpdate = false;

      if (localDigests.length === 0) {
        status = 'local';
      } else {
        const isUpToDate = localDigests.some(d => d.includes(distribution.Descriptor.digest));
        if (!isUpToDate) {
          status = 'available';
          hasUpdate = true;
        }
      }

      return {
        hasUpdate,
        status,
        currentImage,
        localDigests: localDigests,
        latestDigest: remoteDigest
      };
    } catch (err) {
      // 错误处理逻辑
      console.error(`Check update failed for ${currentImage}:`, err.message);
      if (err.message.includes('not found') || err.message.includes('denied')) {
        return { hasUpdate: false, status: 'local', error: err.message };
      } else {
        return { hasUpdate: false, status: 'error', error: err.message };
      }
    }
  } catch (error) {
    return { hasUpdate: false, status: 'error', error: error.message };
  }
}

// 批量检查容器更新 (必须在 /:id/:action 之前定义)
app.post('/api/containers/check-update/batch', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array' });
  }

  try {
    const dockerInstance = getCurrentDocker(req);
    const results = {};

    // 并发限制
    const CONCURRENCY = 5;
    const chunks = [];
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      chunks.push(ids.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (id) => {
        const result = await checkContainerUpdate(dockerInstance, id);
        results[id] = result;
      });
      await Promise.all(promises);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 检查容器更新 (单次)
app.get('/api/containers/:id/check-update', async (req, res) => {
  const { id } = req.params;
  try {
    const dockerInstance = getCurrentDocker(req);
    const result = await checkContainerUpdate(dockerInstance, id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/containers/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  try {
    const dockerInstance = getCurrentDocker(req);
    const container = dockerInstance.getContainer(id);
    switch (action) {
      case 'start': await container.start(); break;
      case 'stop': await container.stop(); break;
      case 'restart': await container.restart(); break;
      case 'pause': await container.pause(); break;
      case 'unpause': await container.unpause(); break;
      case 'remove':
        if (req.body.deleteImage) {
          const imageId = container.image; // 注意：这里可能需要先 inspect 获取完整 Image ID
          // 实际上 container 对象只是 dockerode 的一个引用，不包含 info
          // 所以需要先 inspect
          try {
            const info = await container.inspect();
            const imageId = info.Image;
            await container.remove({ force: true });

            // 尝试删除镜像
            try {
              const image = dockerInstance.getImage(imageId);
              await image.remove();
              console.log(`Image ${imageId} removed successfully.`);
            } catch (imgErr) {
              console.warn(`Failed to remove image ${imageId}:`, imgErr.message);
              // 不阻断流程，仅记录警告
            }
          } catch (err) {
            throw err;
          }
        } else {
          await container.remove({ force: true });
        }
        break;
      default: return res.status(400).json({ error: 'Invalid action' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update container restart policy
app.post('/api/containers/:id/restart-policy', async (req, res) => {
  const { id } = req.params;
  const { policy } = req.body; // 'always', 'unless-stopped', 'no'
  try {
    const dockerInstance = getCurrentDocker(req);
    const container = dockerInstance.getContainer(id);
    await container.update({
      RestartPolicy: { Name: policy }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/containers/create', async (req, res) => {
  const { name, image, env, ports, volumes, restart, labels, network } = req.body;

  // 设置响应头支持流式输出
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');

  const sendEvent = (type, message, data = null) => {
    res.write(JSON.stringify({ type, message, data }) + '\n');
  };

  try {
    const dockerInstance = getCurrentDocker(req);

    // 1. 检查并拉取镜像
    const { alwaysPull } = req.body;
    sendEvent('step', `检查镜像: ${image}`);

    let shouldPull = alwaysPull;
    if (!shouldPull) {
      try {
        await dockerInstance.getImage(image).inspect();
        sendEvent('info', '镜像已存在');
      } catch (err) {
        shouldPull = true;
      }
      sendEvent('pull-start', `开始拉取新镜像: ${image}`);

      await new Promise((resolve, reject) => {
        dockerInstance.pull(image, (err, stream) => {
          if (err) return reject(err);

          dockerInstance.modem.followProgress(stream,
            (err, output) => {
              if (err) return reject(err);
              resolve(output);
            },
            (progress) => {
              sendEvent('pull', 'Pulling', progress);
            }
          );
        });
      });
      sendEvent('success', '镜像拉取完成');
    }

    // 处理图标下载
    const finalLabels = labels || {};
    // 仅本地节点支持图标下载
    const endpointId = req.headers['x-endpoint-id'] || 'local';
    const isLocalNode = endpointId === 'local';

    if (isLocalNode && finalLabels['ICON_URL'] && finalLabels['ICON_URL'].startsWith('http')) {
      const iconUrl = finalLabels['ICON_URL'];
      sendEvent('step', '下载远程图标');

      try {
        // 获取扩展名，默认为 .png
        let ext = path.extname(new URL(iconUrl).pathname);
        if (!ext || ext.length > 5) ext = '.png'; // 简单防错

        const iconFilename = `${name}${ext}`;
        const iconPath = path.join(ICON_DIR, iconFilename);

        await new Promise(async (resolve, reject) => {
          try {
            const response = await fetch(iconUrl);
            if (!response.ok) {
              throw new Error(`Status ${response.status} ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            fs.writeFileSync(iconPath, Buffer.from(arrayBuffer));
            resolve();
          } catch (err) {
            fs.unlink(iconPath, () => { }); // 删除可能损坏的文件
            reject(err);
          }
        });

        finalLabels['ICON_URL'] = `/icon/${iconFilename}`;
        sendEvent('success', '图标下载成功');
      } catch (err) {
        console.warn('Failed to download icon:', err);
        sendEvent('warning', `图标下载失败: ${err.message}，将使用原始链接`);
      }
    }

    // 2. 构建配置
    const containerConfig = {
      Image: image,
      name: name,
      Env: env || [],
      Labels: finalLabels,
      HostConfig: {
        PortBindings: {},
        Binds: volumes || [],
        RestartPolicy: { Name: restart || 'no' },
        NetworkMode: network || 'bridge'
      }
    };

    if (ports && ports.length > 0) {
      const exposedPorts = {};
      ports.forEach(port => {
        const [hostPort, containerPort] = port.split(':');
        const key = `${containerPort}/tcp`;
        exposedPorts[key] = {};
        containerConfig.HostConfig.PortBindings[key] = [{ HostPort: hostPort }];
      });
      containerConfig.ExposedPorts = exposedPorts;
    }

    // 3. 生成并发送 docker run 命令日志
    let runCommand = `docker run -d --name ${name}`;
    if (network && network !== 'bridge') runCommand += ` --network ${network}`;
    if (restart && restart !== 'no') runCommand += ` --restart ${restart}`;
    if (ports) ports.forEach(p => runCommand += ` -p ${p}`);
    if (volumes) volumes.forEach(v => runCommand += ` -v ${v}`);
    if (env) env.forEach(e => runCommand += ` -e "${e}"`);
    if (labels) Object.entries(labels).forEach(([k, v]) => runCommand += ` -l "${k}=${v}"`);
    runCommand += ` ${image}`;

    sendEvent('step', '执行命令');
    sendEvent('command', runCommand);

    // 4. 创建容器
    sendEvent('step', '创建容器');

    let isSelfUpdate = false;

    // 如果是重建，先尝试删除旧容器
    try {
      const oldContainer = dockerInstance.getContainer(name);
      const oldInfo = await oldContainer.inspect();

      // 检测是否是自我更新
      // 获取当前容器ID (在Docker中，hostname通常是容器ID)
      const currentContainerId = os.hostname();

      // 检查ID是否匹配 (注意：hostname可能是短ID，inspect返回的是长ID)
      // 检查ID是否匹配 (注意：hostname可能是短ID，inspect返回的是长ID)
      if (oldInfo.Id.startsWith(currentContainerId) || currentContainerId.startsWith(oldInfo.Id.substring(0, 12))) {
        isSelfUpdate = true;
        console.log(`[Self Update] Detected self-update for container ${name} (${oldInfo.Id})`);
        sendEvent('warning', '⚠️ 检测到正在更新 DMA 自身');
      } else {
        // 检查是否是远程 Agent 更新
        // 条件：非本地节点 + 容器环境变量包含 DMA_MODE=agent
        const endpointId = req.headers['x-endpoint-id'];
        if (endpointId && endpointId !== 'local') {
          const env = oldInfo.Config?.Env || [];
          const isAgent = env.some(e => e.includes('DMA_MODE=agent'));
          if (isAgent) {
            isSelfUpdate = true;
            console.log(`[Agent Update] Detected update for remote agent ${name} on endpoint ${endpointId}`);
            sendEvent('warning', '⚠️ 检测到正在更新远程 Agent');
          }
        }
      }

      if (isSelfUpdate) {
        sendEvent('info', '启动后台更新进程 (Updater)...');

        // 优化：直接使用目标镜像作为 Updater，因为它肯定存在且包含 docker cli (假设是 DMA 镜像)
        const updaterImage = image;

        // 构建 Updater 命令
        // 使用 Base64 编码避免 Shell 转义问题
        // 增加 sleep 时间到 10 秒，确保前端有足够时间接收响应
        const base64Command = Buffer.from(runCommand).toString('base64');
        // 尝试在更新后删除旧镜像
        const oldImageId = oldInfo.Image;
        // 增加 docker pull 确保使用最新镜像 (即使前面的 pull 跳过了)
        const updaterCmdScript = `sleep 10 && docker rm -f ${name} && docker pull ${image} && (echo "${base64Command}" | base64 -d | sh) && (docker rmi ${oldImageId} || true)`;

        console.log(`[Self Update] Updater script (base64): ${base64Command}`);

        // 先发送提示消息，确保前端能收到
        sendEvent('success', '更新进程已启动！');
        sendEvent('info', '服务将重启，连接将暂时中断。请稍后刷新页面。');
        sendEvent('done', '更新中...');

        // 启动 Updater 容器
        // 使用目标镜像作为 Updater
        // 必须挂载 docker socket
        // 动态检测当前容器的 Docker Socket 挂载路径
        let dockerSocketBind = '/var/run/docker.sock:/var/run/docker.sock';
        if (oldInfo.HostConfig && oldInfo.HostConfig.Binds) {
          const socketBind = oldInfo.HostConfig.Binds.find(b => b.includes(':/var/run/docker.sock'));
          if (socketBind) {
            dockerSocketBind = socketBind;
            console.log(`[Self Update] Detected custom Docker socket bind: ${dockerSocketBind}`);
          }
        }

        // Explicitly create and start the container to ensure it runs on remote nodes
        const updaterContainer = await dockerInstance.createContainer({
          Image: updaterImage,
          Entrypoint: ['sh', '-c'], // 强制覆盖 Entrypoint，确保 Cmd 作为 shell 脚本执行
          Cmd: [updaterCmdScript],  // 注意：这里不需要再加 'sh', '-c'，因为 Entrypoint 已经是了，或者 Entrypoint 为空，Cmd 为 ['sh', '-c', script]
          // 修正：如果 Entrypoint 是 sh -c，那么 Cmd 应该是 [script]
          // 为了保险，我们使用 Entrypoint=['sh', '-c'] 和 Cmd=[script]
          name: `${name}-updater-${Date.now()}`,
          HostConfig: {
            Binds: [dockerSocketBind],
            AutoRemove: true
          },
          Detach: true
        });

        console.log(`[Self Update] Updater container created: ${updaterContainer.id}`);

        await updaterContainer.start();
        console.log(`[Self Update] Updater container started`);

        // 结束响应，让前端断开连接
        res.end();
        return;
      }

      sendEvent('info', '发现同名旧容器，正在删除...');
      await oldContainer.remove({ force: true });
      sendEvent('info', '旧容器已删除');
    } catch (e) {
      // 如果是自我更新失败，必须抛出错误，阻止后续创建容器
      if (isSelfUpdate) {
        console.error('Self-update failed:', e);
        sendEvent('error', `自我更新启动失败: ${e.message}`);
        throw e;
      }

      // 容器不存在，忽略，或者 inspect 失败
      if (e.statusCode !== 404) {
        console.error('Error checking old container:', e);
      }
    }

    const container = await dockerInstance.createContainer(containerConfig);
    sendEvent('success', `容器创建成功 ID: ${container.id.substring(0, 12)}`);

    // 5. 启动容器
    sendEvent('step', '启动容器');
    await container.start();
    sendEvent('success', '容器已启动');

    sendEvent('done', '操作全部完成');
    res.end();
  } catch (error) {
    console.error('Create container error:', error);
    sendEvent('error', error.message);
    res.end();
  }
});

app.get('/api/containers/:id/logs', async (req, res) => {
  const { id } = req.params;
  const { tail = '100', timestamps = 'true' } = req.query;
  try {
    const dockerInstance = getCurrentDocker(req);
    const container = dockerInstance.getContainer(id);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: parseInt(tail),
      timestamps: timestamps === 'true'
    });
    res.send(logs.toString('utf8'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch stats endpoint - 批量获取所有容器统计信息
app.get('/api/containers/stats/batch', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const containers = await dockerInstance.listContainers();
    const statsPromises = containers
      .filter(c => c.State === 'running')
      .map(async (container) => {
        try {
          const stats = await dockerInstance.getContainer(container.Id).stats({ stream: false });
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
          const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
          const cpuPercent = systemDelta > 0 ? ((cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100).toFixed(2) : '0.00';

          const memoryUsage = stats.memory_stats.usage || 0;
          const memoryLimit = stats.memory_stats.limit || 1;
          const memoryPercent = ((memoryUsage / memoryLimit) * 100).toFixed(2);
          const memoryFormatted = memoryUsage >= 1024 * 1024 * 1024
            ? (memoryUsage / 1024 / 1024 / 1024).toFixed(2) + ' GB'
            : (memoryUsage / 1024 / 1024).toFixed(2) + ' MB';

          return {
            id: container.Id,
            cpu: { percent: cpuPercent },
            memory: {
              usage: memoryUsage,
              limit: memoryLimit,
              percent: memoryPercent,
              usageFormatted: memoryFormatted
            }
          };
        } catch (error) {
          return { id: container.Id, error: 'Failed to get stats' };
        }
      });

    const allStats = await Promise.all(statsPromises);
    const statsMap = {};
    allStats.forEach(stat => {
      if (!stat.error) {
        statsMap[stat.id] = { cpu: stat.cpu, memory: stat.memory };
      }
    });

    res.json(statsMap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detailed container stats for TreeMap visualization
app.get('/api/containers/detailed-stats', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const containers = await dockerInstance.listContainers({ all: true });

    const detailedStats = await Promise.all(
      containers.map(async (container) => {
        let cpuPercent = 0;
        let memoryUsage = 0;
        let memoryPercent = 0;

        // 只获取运行中容器的stats
        if (container.State === 'running') {
          try {
            const stats = await dockerInstance.getContainer(container.Id).stats({ stream: false });
            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
            const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
            cpuPercent = systemDelta > 0 ? ((cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100) : 0;

            memoryUsage = stats.memory_stats.usage || 0;
            const memoryLimit = stats.memory_stats.limit || 1;
            memoryPercent = (memoryUsage / memoryLimit) * 100;
          } catch (err) {
            // Stats获取失败，使用默认值
          }
        }

        return {
          id: container.Id,
          name: container.Names[0].replace('/', ''),
          image: container.Image,
          state: container.State,
          status: container.Status,
          cpuPercent: parseFloat(cpuPercent.toFixed(2)),
          memoryUsage: memoryUsage,
          memoryPercent: parseFloat(memoryPercent.toFixed(2))
        };
      })
    );

    res.json(detailedStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container stats - 单个容器统计
app.get('/api/containers/:id/stats', async (req, res) => {
  const { id } = req.params;
  try {
    const dockerInstance = getCurrentDocker(req);
    const container = dockerInstance.getContainer(id);
    const stats = await container.stats({ stream: false });

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

    const memUsage = stats.memory_stats.usage || 0;
    const memLimit = stats.memory_stats.limit || 0;
    const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

    res.json({
      cpu: { percent: cpuPercent.toFixed(2) },
      memory: {
        usage: memUsage,
        limit: memLimit,
        percent: memPercent.toFixed(2),
        usageFormatted: (memUsage / 1024 / 1024).toFixed(2) + ' MB',
        limitFormatted: (memLimit / 1024 / 1024).toFixed(2) + ' MB'
      },
      network: stats.networks || {},
      blockIO: stats.blkio_stats || {}
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个容器详情
app.get('/api/containers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const dockerInstance = getCurrentDocker(req);
    const container = dockerInstance.getContainer(id);
    const data = await container.inspect();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新容器
app.post('/api/containers/:id/update', async (req, res) => {
  const { id } = req.params;
  try {
    const dockerInstance = getCurrentDocker(req);
    const container = dockerInstance.getContainer(id);
    const containerInfo = await container.inspect();
    const imageName = containerInfo.Config.Image;

    const stream = await dockerInstance.pull(imageName);
    await new Promise((resolve, reject) => {
      dockerInstance.modem.followProgress(stream, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });

    await container.stop().catch(() => { });
    await container.remove().catch(() => { });

    const newContainer = await dockerInstance.createContainer({
      Image: imageName,
      name: containerInfo.Name.replace('/', ''),
      Env: containerInfo.Config.Env,
      Cmd: containerInfo.Config.Cmd,
      HostConfig: containerInfo.HostConfig,
      ExposedPorts: containerInfo.Config.ExposedPorts
    });

    await newContainer.start();
    res.json({ success: true, message: 'Container updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detailed image stats for TreeMap
app.get('/api/images/detailed-stats', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const images = await dockerInstance.listImages({ all: false });

    const detailedImages = images.map((image, index) => ({
      id: image.Id,
      name: image.RepoTags && image.RepoTags[0] ? image.RepoTags[0] : `<none>:${image.Id.substring(7, 19)}`,
      size: image.Size,
      created: image.Created,
      sizeFormatted: (image.Size / 1024 / 1024).toFixed(2) + ' MB'
    }));

    res.json(detailedImages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detailed volume stats for TreeMap
app.get('/api/volumes/detailed-stats', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const volumesData = await dockerInstance.listVolumes();
    const volumes = volumesData.Volumes || [];

    const detailedVolumes = volumes.map((volume, index) => ({
      id: volume.Name,
      name: volume.Name.length > 20 ? volume.Name.substring(0, 17) + '...' : volume.Name,
      driver: volume.Driver,
      mountpoint: volume.Mountpoint,
      // 使用固定大小作为权重，因为无法直接获取卷大小
      size: 100 * 1024 * 1024 // 100MB作为基础权重
    }));

    res.json(detailedVolumes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 镜像管理 ====================

app.get('/api/images', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const [images, containers] = await Promise.all([
      dockerInstance.listImages({ all: true }),
      dockerInstance.listContainers({ all: true })
    ]);

    // 映射镜像使用情况
    const imageUsage = new Map();
    containers.forEach(container => {
      const imageId = container.ImageID;
      if (!imageUsage.has(imageId)) {
        imageUsage.set(imageId, []);
      }
      imageUsage.get(imageId).push(container.Names[0].replace('/', ''));
    });

    // 添加使用信息
    const imagesWithUsage = images.map(img => ({
      ...img,
      Containers: imageUsage.get(img.Id) || []
    }));

    res.json(imagesWithUsage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/images/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const dockerInstance = getCurrentDocker(req);
    const image = dockerInstance.getImage(id);
    await image.remove({ force: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/images/prune', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const report = await dockerInstance.pruneImages({ filters: { dangling: ['false'] } });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/images/pull', async (req, res) => {
  const { imageName } = req.body;
  if (!imageName) return res.status(400).json({ error: 'Image name is required' });

  try {
    const dockerInstance = getCurrentDocker(req);
    const stream = await dockerInstance.pull(imageName);

    // 设置响应头支持流式输出
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    dockerInstance.modem.followProgress(stream,
      (err, output) => {
        if (err) {
          res.write(JSON.stringify({ error: err.message }) + '\n');
        }
        res.end();
      },
      (event) => {
        res.write(JSON.stringify(event) + '\n');
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/images/stats', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const images = await dockerInstance.listImages({ all: true });
    const imageStats = images.map(img => ({
      id: img.Id,
      repoTags: img.RepoTags || ['<none>:<none>'],
      size: img.Size,
      sizeFormatted: (img.Size / 1024 / 1024).toFixed(2) + ' MB',
      created: img.Created
    }));
    res.json(imageStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 存储卷管理 ====================

app.get('/api/volumes', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const [volumesData, containers] = await Promise.all([
      dockerInstance.listVolumes(),
      dockerInstance.listContainers({ all: true })
    ]);

    const volumes = volumesData.Volumes || [];

    // 映射卷使用情况
    const volumeUsage = new Map();
    containers.forEach(container => {
      container.Mounts?.forEach(mount => {
        if (mount.Type === 'volume') {
          if (!volumeUsage.has(mount.Name)) {
            volumeUsage.set(mount.Name, []);
          }
          volumeUsage.get(mount.Name).push(container.Names[0].replace('/', ''));
        }
      });
    });

    // 添加使用信息
    const volumesWithUsage = volumes.map(vol => ({
      ...vol,
      Containers: volumeUsage.get(vol.Name) || []
    }));

    res.json({ Volumes: volumesWithUsage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/volumes/prune', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    console.log('[Volume Prune] Starting prune...');

    // Debug: List unused volumes first
    const unused = await dockerInstance.listVolumes({ filters: { dangling: ['true'] } });
    console.log('[Volume Prune] Unused volumes found:', unused.Volumes?.length || 0);
    if (unused.Volumes?.length > 0) {
      console.log('[Volume Prune] Volumes to delete:', unused.Volumes.map(v => v.Name));
    }

    // 1. Try standard prune (without dangling filter, as it causes 400 error)
    let report = await dockerInstance.pruneVolumes({ filters: {} });
    console.log('[Volume Prune] Standard prune result:', report);

    // 2. Manual cleanup fallback
    // Some versions/configurations might not prune named volumes via API even if unused
    if (unused.Volumes?.length > 0) {
      const deletedInPrune = new Set(report.VolumesDeleted || []);
      const manualDeleted = [];

      for (const vol of unused.Volumes) {
        if (!deletedInPrune.has(vol.Name)) {
          try {
            console.log(`[Volume Prune] Manually removing volume: ${vol.Name}`);
            const volume = dockerInstance.getVolume(vol.Name);
            await volume.remove();
            manualDeleted.push(vol.Name);
          } catch (err) {
            console.error(`[Volume Prune] Failed to manually remove ${vol.Name}:`, err.message);
          }
        }
      }

      // Merge results
      if (manualDeleted.length > 0) {
        report.VolumesDeleted = [...(report.VolumesDeleted || []), ...manualDeleted];
        // SpaceReclaimed calculation is complex for manual delete, ignoring for now or could fetch usage before delete
      }
    }

    console.log('[Volume Prune] Final report:', report);
    res.json(report);
  } catch (error) {
    console.error('[Volume Prune] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/volumes/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const dockerInstance = getCurrentDocker(req);
    const volume = dockerInstance.getVolume(name);
    await volume.remove();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 网络管理 ====================

app.get('/api/networks', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const networks = await dockerInstance.listNetworks();
    res.json(networks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/networks', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);
    const {
      Name,
      Driver,
      CheckDuplicate,
      Internal,
      Attachable,
      Ingress,
      IPAM,
      EnableIPv6,
      Options,
      Labels
    } = req.body;

    const networkOptions = {
      Name,
      Driver,
      CheckDuplicate,
      Internal,
      Attachable,
      Ingress,
      IPAM,
      EnableIPv6,
      Options,
      Labels
    };

    // 移除未定义的字段
    Object.keys(networkOptions).forEach(key => {
      if (networkOptions[key] === undefined) {
        delete networkOptions[key];
      }
    });

    const network = await dockerInstance.createNetwork(networkOptions);
    res.json(network);
  } catch (error) {
    console.error('Create network error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/networks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const dockerInstance = getCurrentDocker(req);
    const network = dockerInstance.getNetwork(id);
    await network.remove();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 节点管理 ====================

app.get('/api/endpoints', async (req, res) => {
  try {
    const endpointList = Array.from(endpoints.values()).map((ep) => {
      return {
        id: ep.id,
        name: ep.name,
        type: ep.type,
        url: ep.url || null,
        host: ep.host,
        port: ep.port,
        status: 'unknown' // Default status, check via separate API
      };
    });

    res.json(endpointList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/endpoints/status', async (req, res) => {
  try {
    const statusPromises = Array.from(endpoints.values()).map(async (ep) => {
      let status = 'offline';
      try {
        const pingPromise = ep.docker.ping();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        const result = await Promise.race([pingPromise, timeoutPromise]);
        if (result && result.toString() === 'OK') {
          status = 'online';
        }
      } catch (e) {
        // ignore
      }
      return { id: ep.id, status };
    });

    const statuses = await Promise.all(statusPromises);
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/endpoints', async (req, res) => {
  let { id, name, type, url, tls } = req.body;

  // 如果没有ID，生成一个
  if (!id) {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  try {
    let dockerOptions = {};

    if (type === 'local') {
      dockerOptions = { socketPath: '/var/run/docker.sock' };
    } else {
      // Agent模式和TCP模式都使用host/port连接
      const targetHost = req.body.host;
      const targetPort = req.body.port || (type === 'agent' ? 9002 : 2375);

      dockerOptions = {
        host: targetHost,
        port: parseInt(targetPort)
      };

      if (type === 'agent' && req.body.secret) {
        dockerOptions.headers = { 'X-Agent-Secret': req.body.secret };
      }

      if (tls && tls.enabled) {
        dockerOptions.protocol = 'https';
        dockerOptions.ca = fs.readFileSync(tls.caPath);
        dockerOptions.cert = fs.readFileSync(tls.certPath);
        dockerOptions.key = fs.readFileSync(tls.keyPath);
      }
    }

    const newDocker = new Docker(dockerOptions);

    // 尝试连接，但即使失败也允许添加
    try {
      await newDocker.ping();
    } catch (pingError) {
      console.warn(`Warning: Could not ping new endpoint ${name} (${id}):`, pingError.message);
      // 继续执行，不中断添加流程
    }

    endpoints.set(id, {
      id,
      name,
      type,
      url: type === 'local' ? null : `tcp://${dockerOptions.host}:${dockerOptions.port}`,
      host: dockerOptions.host,
      port: dockerOptions.port,
      secret: req.body.secret, // 保存Agent密钥
      docker: newDocker
    });
    saveEndpoints(endpoints); // 持久化保存
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/endpoints/:id', async (req, res) => {
  const { id } = req.params;
  if (id === 'local') {
    return res.status(400).json({ error: 'Cannot delete local endpoint' });
  }
  try {
    endpoints.delete(id);
    saveEndpoints(endpoints); // 持久化保存
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/endpoints/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, url } = req.body;

  try {
    const endpoint = endpoints.get(id);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    // 更新节点信息
    const updatedEndpoint = {
      ...endpoint,
      name: name || endpoint.name
    };

    // 如果不是本地节点，允许更新URL
    // 如果不是本地节点，允许更新连接信息
    if (type !== 'local') {
      let newHost = endpoint.host;
      let newPort = endpoint.port;
      let newSecret = endpoint.secret;

      // 1. 处理 Host/Port 更新
      if (req.body.host) newHost = req.body.host;
      if (req.body.port) newPort = parseInt(req.body.port);

      // 兼容旧的 URL 方式 (虽然前端现在主要发 host/port)
      if (url && url.startsWith('tcp://')) {
        const urlParts = url.replace('tcp://', '').split(':');
        newHost = urlParts[0];
        newPort = parseInt(urlParts[1]) || (type === 'agent' ? 9002 : 2375);
      }

      // 2. 处理 Secret 更新
      if (req.body.secret !== undefined) {
        newSecret = req.body.secret;
      }

      // 3. 构建 Docker 选项
      const dockerOptions = {
        host: newHost,
        port: newPort || (type === 'agent' ? 9002 : 2375)
      };

      if (type === 'agent' && newSecret) {
        dockerOptions.headers = { 'X-Agent-Secret': newSecret };
      }

      // 4. 测试连接 (允许失败)
      const newDocker = new Docker(dockerOptions);
      try {
        await newDocker.ping();
      } catch (e) {
        console.warn(`Warning: Could not ping updated endpoint ${name} (${id}):`, e.message);
      }

      // 5. 更新对象
      updatedEndpoint.url = type === 'local' ? null : `tcp://${newHost}:${newPort}`;
      updatedEndpoint.host = newHost;
      updatedEndpoint.port = newPort;
      updatedEndpoint.secret = newSecret;
      updatedEndpoint.docker = newDocker;
    } else {
      // 如果是本地节点，只允许更新 host
      if (req.body.host) {
        updatedEndpoint.host = req.body.host;
      }
    }

    endpoints.set(id, updatedEndpoint);
    saveEndpoints(endpoints); // 持久化保存
    res.json({ success: true, endpoint: updatedEndpoint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/endpoints/test', async (req, res) => {
  const { type, url, tls } = req.body;
  try {
    let dockerOptions = {};

    if (type === 'local') {
      dockerOptions = { socketPath: '/var/run/docker.sock' };
    } else {
      const urlParts = url.replace('tcp://', '').split(':');
      dockerOptions = {
        host: urlParts[0],
        port: parseInt(urlParts[1]) || 2375
      };
    }

    const testDocker = new Docker(dockerOptions);
    await testDocker.ping();
    const version = await testDocker.version();
    res.json({ success: true, version });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ==================== 用户模板管理 ====================

const USER_TEMPLATES_DIR = path.join(__dirname, 'data', 'user_templates');

// 确保模板目录存在
if (!fs.existsSync(USER_TEMPLATES_DIR)) {
  fs.mkdirSync(USER_TEMPLATES_DIR, { recursive: true });
}

// 获取用户模板列表
app.get('/api/templates/user', async (req, res) => {
  try {
    const files = await fs.promises.readdir(USER_TEMPLATES_DIR);
    const templates = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.promises.readFile(path.join(USER_TEMPLATES_DIR, file), 'utf8');
          const template = JSON.parse(content);
          templates.push(template);
        } catch (err) {
          console.error(`Failed to read template ${file}:`, err);
        }
      }
    }

    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存用户模板
app.post('/api/templates/user', async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: 'Template name and data are required' });
    }

    // 使用容器名称作为文件名，替换非法字符
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(USER_TEMPLATES_DIR, `${safeName}.json`);

    const newTemplate = {
      id: safeName, // 使用文件名作为ID
      name,
      data,
      created: new Date().toISOString()
    };

    await fs.promises.writeFile(filePath, JSON.stringify(newTemplate, null, 2));
    res.json({ success: true, template: newTemplate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除用户模板
app.delete('/api/templates/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // id 就是 safeName
    const filePath = path.join(USER_TEMPLATES_DIR, `${id}.json`);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== WebSocket ====================

wss.on('connection', async (ws, req) => {
  console.log('WebSocket client connected');

  // 解析 URL 获取容器 ID
  // URL 格式: /ws/container/:id/terminal
  const match = req.url.match(/\/ws\/container\/([^\/]+)\/terminal/);
  if (!match) {
    console.log('Invalid WebSocket URL:', req.url);
    ws.close();
    return;
  }

  const containerId = match[1];
  console.log(`Attaching to container ${containerId}`);

  try {
    // 解析 endpointId
    const url = new URL(req.url, `http://${req.headers.host}`);
    const endpointId = url.searchParams.get('endpointId') || 'local';

    console.log(`[WebSocket] Connection request for container ${containerId}, endpoint: ${endpointId}`);

    let dockerInstance = docker;
    if (endpointId !== 'local') {
      const endpoint = endpoints.get(endpointId);
      if (endpoint && endpoint.docker) {
        dockerInstance = endpoint.docker;
        console.log(`[WebSocket] Using remote endpoint: ${endpoint.name} (${endpoint.host}:${endpoint.port})`);
      } else {
        console.warn(`[WebSocket] Endpoint ${endpointId} not found, falling back to local`);
      }
    } else {
      console.log(`[WebSocket] Using local endpoint`);
    }

    console.log(`[WebSocket] Getting container instance for ${containerId}...`);
    if (!dockerInstance) {
      console.error('[WebSocket] Critical Error: dockerInstance is null/undefined!');
      throw new Error('dockerInstance is missing');
    }
    const container = dockerInstance.getContainer(containerId);
    console.log(`[WebSocket] Container instance created`);

    // 创建 exec 实例
    console.log(`[WebSocket] Creating exec instance for ${containerId}...`);
    const exec = await container.exec({
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ['/bin/sh', '-c', 'if [ -x /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi']
    });

    // 启动 exec 实例 (这会发起 WebSocket 升级请求)
    console.log(`[WebSocket] Starting exec stream for ${containerId}...`);
    const stream = await exec.start({
      hijack: true,
      stdin: true
    });

    console.log(`[WebSocket] Exec stream started successfully`);

    // Docker stream -> WebSocket
    stream.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk.toString());
      }
    });

    stream.on('end', () => {
      console.log('Docker stream ended');
      ws.close();
    });

    // WebSocket -> Docker stream
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.type === 'input') {
          stream.write(msg.data);
        } else if (msg.type === 'resize') {
          exec.resize({ h: msg.rows, w: msg.cols });
        }
      } catch (e) {
        // 如果不是 JSON，直接写入（兼容性）
        stream.write(message);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      stream.end();
    });


  } catch (error) {
    console.error('WebSocket connection error:', error);
    ws.send(`Connection error: ${error.message}\r\n`);
    ws.close();
  }
});

// ==================== 堆栈与模板管理 ====================

// 定义存储路径
const COMPOSE_DIR = path.join(DATA_DIR, 'compose');
const STACKS_DIR = path.join(COMPOSE_DIR, 'stacks');
const TEMPLATES_DIR = path.join(COMPOSE_DIR, 'templates');

// 确保目录存在
[COMPOSE_DIR, STACKS_DIR, TEMPLATES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 辅助函数：查找堆栈 (根据名称和节点ID)
function findStack(name, endpointId) {
  for (const stack of stacks.values()) {
    if (stack.name === name && stack.endpointId === endpointId) {
      return stack;
    }
  }
  return null;
}

// 从磁盘加载堆栈
function loadStacksFromDisk() {
  const stacksMap = new Map();
  if (!fs.existsSync(STACKS_DIR)) return stacksMap;

  const stackFolders = fs.readdirSync(STACKS_DIR);
  for (const folder of stackFolders) {
    const metadataPath = path.join(STACKS_DIR, folder, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        // 注入 folder ID，用于后续操作定位目录
        metadata.id = folder;
        // 使用 ID 作为 Key，允许不同节点有同名堆栈
        stacksMap.set(folder, metadata);
      } catch (error) {
        console.error(`Failed to load stack metadata for ${folder}:`, error);
      }
    }
  }
  return stacksMap;
}

// 获取下一个堆栈ID (100-999)
function getNextStackId() {
  if (!fs.existsSync(STACKS_DIR)) return '100';

  const folders = fs.readdirSync(STACKS_DIR);
  let maxId = 99;

  for (const folder of folders) {
    // 只匹配 3 位数字的文件夹
    if (/^\d{3}$/.test(folder)) {
      const id = parseInt(folder, 10);
      if (id > maxId) maxId = id;
    }
  }

  return String(maxId + 1).padStart(3, '0');
}

// 保存堆栈元数据
function saveStackMetadata(name, metadata) {
  const stackFolder = metadata.id || name;
  const stackDir = path.join(STACKS_DIR, stackFolder);
  const metadataPath = path.join(stackDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
}

// 从磁盘加载模板
function loadTemplatesFromDisk() {
  const templatesMap = new Map();
  if (!fs.existsSync(TEMPLATES_DIR)) return templatesMap;

  const templateFolders = fs.readdirSync(TEMPLATES_DIR);
  for (const folder of templateFolders) {
    const templateInfoPath = path.join(TEMPLATES_DIR, folder, 'template.json');
    if (fs.existsSync(templateInfoPath)) {
      try {
        const templateInfo = JSON.parse(fs.readFileSync(templateInfoPath, 'utf8'));

        // Load compose content
        const composePath = path.join(TEMPLATES_DIR, folder, 'docker-compose.yml');
        if (fs.existsSync(composePath)) {
          templateInfo.composeContent = fs.readFileSync(composePath, 'utf8');
        }

        templatesMap.set(folder, templateInfo);
      } catch (error) {
        console.error(`Failed to load template info for ${folder}:`, error);
      }
    }
  }
  return templatesMap;
}

// 保存模板信息
function saveTemplateInfo(name, templateInfo) {
  const templateDir = path.join(TEMPLATES_DIR, name);
  const templateInfoPath = path.join(templateDir, 'template.json');
  fs.writeFileSync(templateInfoPath, JSON.stringify(templateInfo, null, 2), 'utf8');
}

// 检测堆栈状态
async function getStackStatus(stackName, dockerInstance) {
  try {
    const containers = await dockerInstance.listContainers({
      all: true,
      filters: {
        label: [`com.docker.compose.project=${stackName}`]
      }
    });

    if (containers.length === 0) return 'stopped';

    const runningCount = containers.filter(c => c.State === 'running').length;
    if (runningCount === 0) return 'stopped';
    if (runningCount === containers.length) return 'running';
    return 'partial';
  } catch (error) {
    console.error(`Failed to get stack status for ${stackName}:`, error);
    return 'unknown';
  }
}

// 辅助函数：执行 Compose 命令


// 初始化堆栈和模板存储
const stacks = loadStacksFromDisk();
const templates = loadTemplatesFromDisk();

console.log(`Loaded ${stacks.size} stacks and ${templates.size} templates from disk`);

// ========== 堆栈 API ==========

// 获取所有堆栈（包括外部创建的）
app.get('/api/stacks', async (req, res) => {
  try {
    const dockerInstance = getCurrentDocker(req);

    // 1. 扫描所有容器，发现 Compose 项目
    const allContainers = await dockerInstance.listContainers({ all: true });
    const discoveredProjects = new Map();

    for (const container of allContainers) {
      const projectLabel = container.Labels['com.docker.compose.project'];
      if (projectLabel) {
        if (!discoveredProjects.has(projectLabel)) {
          discoveredProjects.set(projectLabel, []);
        }
        discoveredProjects.get(projectLabel).push(container);
      }
    }

    // 2. 合并本地元数据和发现的项目


    // 先处理有元数据的堆栈


    const stackList = [];
    const currentEndpointId = req.headers['x-endpoint-id'] || 'local';

    for (const [id, metadata] of stacks) {
      // 过滤掉不属于当前 endpoint 的堆栈
      if (metadata.endpointId !== currentEndpointId) {
        continue;
      }

      const stackName = metadata.name;
      const status = await getStackStatus(stackName, dockerInstance);

      // 获取堆栈的容器列表以计算服务数量
      const stackContainers = await dockerInstance.listContainers({
        all: true,
        filters: { label: [`com.docker.compose.project=${stackName}`] }
      });
      const uniqueServices = new Set(stackContainers.map(c => c.Labels['com.docker.compose.service']));

      stackList.push({
        name: stackName,
        status,
        services: uniqueServices.size, // 正确计算服务数量
        serviceNames: Array.from(uniqueServices).slice(0, 3),
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        description: metadata.description,
        endpointId: metadata.endpointId,
        managed: true,
        id: metadata.id
      });
    }

    // 获取外部堆栈 (仅当 endpointId 为 local 时，或者我们需要远程扫描外部堆栈时)
    // 目前简化逻辑：只显示受管堆栈，或者后续添加扫描逻辑
    // 为了兼容现有逻辑，我们暂时保留扫描，但加上 endpoint 过滤

    // const dockerInstance = getCurrentDocker(req); // Removed duplicate declaration
    const containers = await dockerInstance.listContainers({
      all: true,
      filters: { label: ['com.docker.compose.project'] }
    });

    const projectGroups = {};
    containers.forEach(c => {
      const projectName = c.Labels['com.docker.compose.project'];
      // 如果已在受管堆栈中，跳过
      if (findStack(projectName, currentEndpointId)) return;

      if (!projectGroups[projectName]) {
        projectGroups[projectName] = [];
      }
      projectGroups[projectName].push(c);
    });

    for (const [projectName, containers] of Object.entries(projectGroups)) {
      const uniqueServices = new Set(containers.map(c => c.Labels['com.docker.compose.service']));
      const workingDir = containers[0].Labels['com.docker.compose.project.working_dir'];

      // 简单判断状态
      const runningCount = containers.filter(c => c.State === 'running').length;
      let status = 'stopped';
      if (runningCount === containers.length) status = 'running';
      else if (runningCount > 0) status = 'partial';

      const services = Array.from(uniqueServices);
      const oldestContainer = containers.reduce((oldest, c) =>
        c.Created < oldest.Created ? c : oldest, containers[0]);

      stackList.push({
        name: projectName,
        status,
        services: services.length,
        serviceNames: services.slice(0, 3),
        createdAt: new Date(oldestContainer.Created * 1000).toISOString(),
        updatedAt: new Date(oldestContainer.Created * 1000).toISOString(),
        description: workingDir ? `外部堆栈 (${workingDir})` : '外部创建的堆栈',
        endpointId: currentEndpointId,
        managed: false
      });
    }

    stackList.sort((a, b) => a.name.localeCompare(b.name));
    res.json(stackList);
  } catch (error) {
    console.error('Failed to fetch stacks:', error);
    res.status(500).json({ error: error.message });
  }
});


// 部署堆栈（流式日志）
// 堆栈部署接口已移至后面统一管理 (见 app.post('/api/stacks/:name/deploy') 约第2266行)

// 创建堆栈

app.post('/api/stacks', async (req, res) => {
  const { name, composeContent, description, autoDeploy, env } = req.body;

  if (!name || !composeContent) {
    return res.status(400).json({ error: 'Name and composeContent required' });
  }

  try {
    const currentEndpointId = req.headers['x-endpoint-id'] || 'local';

    // 检查堆栈是否已存在 (仅检查当前节点)
    if (findStack(name, currentEndpointId)) {
      return res.status(409).json({ error: 'Stack already exists on this node' });
    }

    // 使用数字ID创建目录
    const stackId = getNextStackId();
    const stackDir = path.join(STACKS_DIR, stackId);

    // 创建堆栈目录
    if (!fs.existsSync(stackDir)) {
      fs.mkdirSync(stackDir, { recursive: true });
    }

    // 保存 Compose 文件
    const composePath = path.join(stackDir, 'docker-compose.yml');
    fs.writeFileSync(composePath, composeContent, 'utf8');

    // 创建元数据（包含环境变量）
    const metadata = {
      name,
      id: stackId, // 保存目录ID
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      endpointId: currentEndpointId,
      status: 'stopped',
      env: env || [] // 保存环境变量
    };

    // 保存元数据
    saveStackMetadata(name, metadata);
    stacks.set(stackId, metadata);

    // ✅ 自动保存为模板（新增功能）
    try {
      console.log(`[Stack Create] Auto-saving stack ${name} as template`);
      const templateDir = path.join(TEMPLATES_DIR, name);

      // 创建模板目录
      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }

      // 复制 compose 文件到模板目录
      const templateComposePath = path.join(templateDir, 'docker-compose.yml');
      fs.copyFileSync(composePath, templateComposePath);

      // 创建模板信息
      const templateInfo = {
        name,
        title: name,
        description: description || `从堆栈 ${name} 自动创建的模板`,
        category: 'Custom',
        tags: ['custom', 'user-created'],
        author: 'User',
        createdAt: new Date().toISOString(),
        composeContent
      };

      // 保存模板信息
      const templateInfoPath = path.join(templateDir, 'template.json');
      fs.writeFileSync(templateInfoPath, JSON.stringify(templateInfo, null, 2), 'utf8');

      // 添加到内存中的模板Map
      templates.set(name, templateInfo);
      console.log(`[Stack Create] Template ${name} saved successfully`);
    } catch (templateError) {
      console.error(`[Stack Create] Failed to auto-save template:`, templateError);
      // 不影响堆栈创建，只是记录错误
    }

    // 如果需要自动部署
    if (autoDeploy) {
      const dockerInstance = getCurrentDocker(req);

      try {
        const endpoint = endpoints.get(currentEndpointId);
        await stackManager.executeCompose(
          `up -d`,
          stackDir,
          endpoint,
          name, // 传递 stackName
          null, // onLog
          metadata.env // 传递环境变量
        );

        metadata.status = 'running';
        metadata.updatedAt = new Date().toISOString();
        saveStackMetadata(name, metadata);
      } catch (deployError) {
        console.error(`Deploy error for ${name}:`, deployError);
        // 部署失败不应导致创建失败，但需要记录状态
      }
    }

    res.json({ success: true, stack: { name, ...metadata } });
  } catch (error) {
    console.error('Failed to create stack:', error);
    res.status(500).json({ error: error.message });
  }
});


// ========== 用户容器模板 API ==========
const USER_TEMPLATES_FILE = path.join(DATA_DIR, 'user_templates.json');

// Get user templates
app.get('/api/templates/user', (req, res) => {
  try {
    if (fs.existsSync(USER_TEMPLATES_FILE)) {
      const data = fs.readFileSync(USER_TEMPLATES_FILE, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save user template
app.post('/api/templates/user', (req, res) => {
  const { name, data } = req.body;
  try {
    let templates = [];
    if (fs.existsSync(USER_TEMPLATES_FILE)) {
      templates = JSON.parse(fs.readFileSync(USER_TEMPLATES_FILE, 'utf8'));
    }

    const existingIndex = templates.findIndex(t => t.name === name);
    // Keep original ID if exists, otherwise generate new one
    const id = existingIndex >= 0 ? templates[existingIndex].id : Date.now().toString();

    const newTemplate = {
      id,
      name,
      data,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      templates[existingIndex] = newTemplate;
    } else {
      templates.push(newTemplate);
    }

    fs.writeFileSync(USER_TEMPLATES_FILE, JSON.stringify(templates, null, 2));
    res.json({ success: true, template: newTemplate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user template
app.delete('/api/templates/user/:id', (req, res) => {
  const { id } = req.params;
  try {
    if (fs.existsSync(USER_TEMPLATES_FILE)) {
      let templates = JSON.parse(fs.readFileSync(USER_TEMPLATES_FILE, 'utf8'));
      templates = templates.filter(t => t.id !== id);
      fs.writeFileSync(USER_TEMPLATES_FILE, JSON.stringify(templates, null, 2));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 模板 API ==========
// ⚠️ 重要：模板相关路由必须在 /api/stacks/:name 之前定义
// 因为Express按顺序匹配路由，/api/stacks/:name 会匹配 /api/stacks/templates
// 导致 templates 被当作 :name 参数处理

// 获取所有模板
app.get('/api/stacks/templates', (req, res) => {
  console.log('GET /api/stacks/templates called');
  try {
    const templateList = Array.from(templates.values()).map(t => ({
      name: t.name,
      title: t.title,
      description: t.description,
      category: t.category,
      tags: t.tags,
      author: t.author,
      tags: t.tags,
      author: t.author,
      createdAt: t.createdAt,
      composeContent: t.composeContent // Include compose content in list
    }));
    console.log(`Returning ${templateList.length} templates`);
    res.json(templateList);
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取模板详情
app.get('/api/stacks/templates/:name', (req, res) => {
  const { name } = req.params;

  try {
    const templateInfo = templates.get(name);
    if (!templateInfo) return res.status(404).json({ error: 'Template not found' });

    const composePath = path.join(TEMPLATES_DIR, name, 'docker-compose.yml');
    if (!fs.existsSync(composePath)) {
      return res.status(404).json({ error: 'Template compose file not found' });
    }

    const composeContent = fs.readFileSync(composePath, 'utf8');

    res.json({
      ...templateInfo,
      composeContent
    });
  } catch (error) {
    console.error(`Failed to get template ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 创建模板
app.post('/api/stacks/templates', (req, res) => {
  const { name, title, description, composeContent, category, tags, author } = req.body;
  console.log('POST /api/stacks/templates called, name:', name);

  if (!name || !composeContent) {
    return res.status(400).json({ error: 'Name and composeContent required' });
  }

  try {
    // 检查模板是否已存在
    if (templates.has(name)) {
      return res.status(409).json({ error: 'Template already exists' });
    }

    const templateDir = path.join(TEMPLATES_DIR, name);

    // 创建模板目录
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    // 保存 Compose 文件
    const composePath = path.join(templateDir, 'docker-compose.yml');
    fs.writeFileSync(composePath, composeContent, 'utf8');

    // 创建模板信息
    const templateInfo = {
      name,
      title: title || name,
      description: description || '',
      category: category || 'Custom',
      tags: tags || [],
      author: author || 'User',
      createdAt: new Date().toISOString(),
      composeContent // Store in memory
    };

    // 保存模板信息
    saveTemplateInfo(name, templateInfo);
    templates.set(name, templateInfo);

    console.log(`Template '${name}' created successfully. Total templates: ${templates.size}`);
    res.json({ success: true, template: templateInfo });
  } catch (error) {
    console.error('Failed to create template:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新模板
app.put('/api/stacks/templates/:name', (req, res) => {
  const { name } = req.params;
  const { title, description, composeContent, category, tags } = req.body;

  try {
    const templateInfo = templates.get(name);
    if (!templateInfo) return res.status(404).json({ error: 'Template not found' });

    // 更新模板信息
    if (title) templateInfo.title = title;
    if (description !== undefined) templateInfo.description = description;
    if (category) templateInfo.category = category;
    if (tags) templateInfo.tags = tags;

    // 更新 Compose 文件
    if (composeContent) {
      const composePath = path.join(TEMPLATES_DIR, name, 'docker-compose.yml');
      fs.writeFileSync(composePath, composeContent, 'utf8');
    }

    saveTemplateInfo(name, templateInfo);
    res.json({ success: true, template: templateInfo });
  } catch (error) {
    console.error(`Failed to update template ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 删除模板
app.delete('/api/stacks/templates/:name', (req, res) => {
  const { name } = req.params;

  try {
    const templateDir = path.join(TEMPLATES_DIR, name);

    if (fs.existsSync(templateDir)) {
      fs.rmSync(templateDir, { recursive: true, force: true });
    }
    templates.delete(name);

    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete template ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 从模板部署堆栈
app.post('/api/stacks/templates/:templateName/deploy', async (req, res) => {
  const { templateName } = req.params;
  const { stackName, variables } = req.body;

  if (!stackName) {
    return res.status(400).json({ error: 'stackName required' });
  }

  try {
    const templateInfo = templates.get(templateName);
    if (!templateInfo) return res.status(404).json({ error: 'Template not found' });

    // 检查堆栈名称是否已存在
    if (stacks.has(stackName)) {
      return res.status(409).json({ error: 'Stack name already exists' });
    }

    // 读取模板 Compose 内容
    const templateComposePath = path.join(TEMPLATES_DIR, templateName, 'docker-compose.yml');
    let composeContent = fs.readFileSync(templateComposePath, 'utf8');

    // 替换变量（简单字符串替换）
    if (variables && typeof variables === 'object') {
      for (const [key, value] of Object.entries(variables)) {
        composeContent = composeContent.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
      }
    }

    // 创建堆栈目录 (使用数字ID)
    const stackId = getNextStackId();
    const stackDir = path.join(STACKS_DIR, stackId);
    if (!fs.existsSync(stackDir)) {
      fs.mkdirSync(stackDir, { recursive: true });
    }

    // 保存 Compose 文件
    const composePath = path.join(stackDir, 'docker-compose.yml');
    fs.writeFileSync(composePath, composeContent, 'utf8');

    // 获取当前选择的 endpoint
    const currentEndpointId = req.headers['x-endpoint-id'] || 'local';

    // 创建元数据（包含环境变量）
    const metadata = {
      name: stackName,
      id: stackId, // 保存目录ID
      description: `Deployed from template: ${templateInfo.title}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      endpointId: currentEndpointId,
      status: 'stopped',
      templateSource: templateName,
      env: req.body.env || [] // 保存环境变量
    };

    saveStackMetadata(stackName, metadata);
    stacks.set(stackId, metadata);

    // 自动部署
    if (!req.body.skipDeploy) {
      try {
        const endpoint = endpoints.get(currentEndpointId);
        await stackManager.executeCompose(
          `up -d`,
          stackDir,
          endpoint,
          stackName, // 传递 stackName
          null, // onLog
          metadata.env // 传递环境变量
        );

        metadata.status = 'running';
        metadata.updatedAt = new Date().toISOString();
        saveStackMetadata(stackName, metadata);
      } catch (deployError) {
        console.error(`Deploy error for ${stackName}:`, deployError);
      }
    }

    res.json({ success: true, stackName });
  } catch (error) {
    console.error('Failed to deploy from template:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 远程堆栈执行辅助函数 ==========

// 创建临时代理以注入 Agent Secret


// 获取堆栈详情
app.get('/api/stacks/:name', async (req, res) => {
  const { name } = req.params;

  try {
    const endpointId = req.headers['x-endpoint-id'] || 'local';
    const metadata = findStack(name, endpointId);
    if (!metadata) return res.status(404).json({ error: 'Stack not found' });

    const stackFolder = metadata.id || name;
    const composePath = path.join(STACKS_DIR, stackFolder, 'docker-compose.yml');
    if (!fs.existsSync(composePath)) {
      return res.status(404).json({ error: 'Compose file not found' });
    }

    const composeContent = fs.readFileSync(composePath, 'utf8');
    const dockerInstance = getCurrentDocker(req);
    const status = await getStackStatus(name, dockerInstance);

    // 获取服务容器信息
    const containers = await dockerInstance.listContainers({
      all: true,
      filters: {
        label: [`com.docker.compose.project=${name}`]
      }
    });

    const serviceDetails = containers.map(c => ({
      name: c.Labels['com.docker.compose.service'],
      containerId: c.Id,
      status: c.State,
      image: c.Image,
      ports: c.Ports
    }));

    res.json({
      name,
      status,
      composeContent,
      services: serviceDetails,
      metadata
    });
  } catch (error) {
    console.error(`Failed to get stack ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 更新堆栈
app.put('/api/stacks/:name', async (req, res) => {
  const { name } = req.params;
  const { composeContent, redeploy } = req.body;

  try {
    const endpointId = req.headers['x-endpoint-id'] || 'local';
    const metadata = findStack(name, endpointId);
    if (!metadata) return res.status(404).json({ error: 'Stack not found' });

    const stackFolder = metadata.id || name;
    const composePath = path.join(STACKS_DIR, stackFolder, 'docker-compose.yml');

    // 更新 Compose 文件
    fs.writeFileSync(composePath, composeContent, 'utf8');

    // 更新元数据
    metadata.updatedAt = new Date().toISOString();
    saveStackMetadata(name, metadata);

    // 如果需要重新部署
    if (redeploy) {
      const endpoint = endpoints.get(endpointId);

      // 使用 StackManager 执行重新部署 (up -d --force-recreate)
      // 注意：这里我们使用 executeCompose，它会自动处理远程代理
      await stackManager.executeCompose(
        `up -d --force-recreate`,
        path.join(STACKS_DIR, stackFolder),
        endpoint,
        name,
        null, // onLog (可选：如果需要记录日志，可以传递回调)
        metadata.env // 传递环境变量
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to update stack ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 部署堆栈 (流式输出)
app.post('/api/stacks/:name/deploy', async (req, res) => {
  const { name } = req.params;
  const { isNew, pull } = req.body;

  console.log(`[Stack Deploy] Starting deployment for: ${name}, isNew: ${isNew}`);

  try {
    const endpointId = req.headers['x-endpoint-id'] || 'local';
    const metadata = findStack(name, endpointId);
    if (!metadata) {
      console.error(`[Stack Deploy] Stack not found: ${name}`);
      return res.status(404).json({ error: 'Stack not found' });
    }

    const stackFolder = metadata.id || name;
    const stackDir = path.join(STACKS_DIR, stackFolder);
    const composePath = path.join(stackDir, 'docker-compose.yml');

    if (!fs.existsSync(composePath)) {
      console.error(`[Stack Deploy] docker-compose.yml not found: ${composePath}`);
      return res.status(404).json({ error: 'docker-compose.yml not found' });
    }

    // 设置响应头支持流式输出（在验证通过后）
    console.log(`[Stack Deploy] Setting headers for streaming`);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用nginx缓冲

    // 统一的事件发送函数，与容器创建保持一致
    const sendEvent = (type, message, data = null) => {
      const event = { type, message, data };
      console.log(`[Stack Deploy] Sending event:`, event);
      res.write(JSON.stringify(event) + '\n');
    };

    sendEvent('step', '初始化部署环境');

    const dockerInstance = getCurrentDocker(req);
    const { exec, spawn } = await import('child_process');

    // 1. 解析 Compose 文件获取镜像列表
    sendEvent('step', '解析 docker-compose.yml');
    const composeContent = fs.readFileSync(composePath, 'utf8');
    const parsed = yaml.load(composeContent);
    const images = new Set();

    if (parsed && parsed.services) {
      for (const service of Object.values(parsed.services)) {
        if (service.image) {
          images.add(service.image);
        }
      }
    }

    console.log(`[Stack Deploy] Found ${images.size} images:`, Array.from(images));
    sendEvent('info', `发现 ${images.size} 个镜像需要检查`);

    // 2. 拉取镜像
    for (const imageName of images) {
      sendEvent('step', `检查镜像: ${imageName}`);

      // 检查镜像是否存在
      let shouldPull = false;
      if (req.body.pull) {
        shouldPull = true;
        sendEvent('info', '用户请求强制拉取最新镜像');
      } else {
        try {
          await dockerInstance.getImage(imageName).inspect();
          console.log(`[Stack Deploy] Image exists: ${imageName}`);
          sendEvent('info', '镜像已存在');
        } catch (err) {
          console.log(`[Stack Deploy] Image not found, need to pull: ${imageName}`);
          shouldPull = true;
        }
      }

      if (shouldPull) {
        sendEvent('pull-start', `开始拉取新镜像: ${imageName}`);

        try {
          await new Promise((resolve, reject) => {
            dockerInstance.pull(imageName, (err, stream) => {
              if (err) return reject(err);

              dockerInstance.modem.followProgress(stream,
                (err, output) => {
                  if (err) return reject(err);
                  console.log(`[Stack Deploy] Image pull completed: ${imageName}`);
                  resolve(output);
                },
                (progress) => {
                  sendEvent('pull', 'Pulling', progress);
                }
              );
            });
          });
          sendEvent('success', '镜像拉取完成');
        } catch (pullError) {
          console.warn(`[Stack Deploy] Failed to pull image ${imageName}:`, pullError);
          sendEvent('warning', `无法拉取镜像 ${imageName}: ${pullError.message}，尝试使用本地镜像...`);
        }
      }
    }

    // 3. 执行 docker compose up
    sendEvent('step', '启动堆栈容器');

    // 使用 executeCompose 确保统一的项目命名逻辑 (-p stackName)
    const endpoint = endpoints.get(req.headers['x-endpoint-id'] || 'local');
    await stackManager.executeCompose(
      `up -d`,
      stackDir,
      endpoint,
      name, // 传递 stackName
      (line) => sendEvent('log', line) // 合并 stdout/stderr 回调
    );

    sendEvent('success', '堆栈部署成功');

    // 更新状态
    metadata.status = 'running';
    metadata.updatedAt = new Date().toISOString();
    saveStackMetadata(name, metadata);

    // 发送完成事件
    sendEvent('done', '部署完成');
    res.end();

  } catch (error) {
    console.error(`[Stack Deploy] Failed to deploy stack ${name}:`, error);

    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');
      const sendEvent = (type, message) => {
        res.write(JSON.stringify({ type, message }) + '\n');
      };
      sendEvent('error', error.message);
    } else {
      res.write(JSON.stringify({ type: 'error', message: error.message }) + '\n');
    }
    res.end();

    // 如果是新创建的堆栈且部署失败，则清理
    if (isNew) {
      try {
        console.log(`[Stack Deploy] Cleaning up failed new stack: ${name}`);
        const endpointId = req.headers['x-endpoint-id'] || 'local';
        const meta = findStack(name, endpointId);
        if (meta) {
          const stackDir = path.join(STACKS_DIR, meta.id);
          if (fs.existsSync(stackDir)) {
            fs.rmSync(stackDir, { recursive: true, force: true });
          }
          stacks.delete(meta.id);
        }
      } catch (cleanupError) {
        console.error(`[Stack Deploy] Failed to cleanup stack ${name}:`, cleanupError);
      }
    }
  }
});

// 启动堆栈 (旧接口保留用于简单的启动操作)
app.post('/api/stacks/:name/start', async (req, res) => {
  const { name } = req.params;

  try {
    const endpointId = req.headers['x-endpoint-id'] || 'local';
    const metadata = findStack(name, endpointId);
    if (!metadata) return res.status(404).json({ error: 'Stack not found' });

    const stackFolder = metadata.id || name;
    const stackDir = path.join(STACKS_DIR, stackFolder);
    const composePath = path.join(stackDir, 'docker-compose.yml');

    const endpoint = endpoints.get(metadata.endpointId);
    const { stdout, stderr } = await stackManager.executeCompose(
      `up -d`,
      stackDir,
      endpoint,
      name // 传递 stackName
    );

    metadata.status = 'running';
    metadata.updatedAt = new Date().toISOString();
    saveStackMetadata(name, metadata);

    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error(`Failed to start stack ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 停止堆栈
app.post('/api/stacks/:name/stop', async (req, res) => {
  const { name } = req.params;

  try {
    const endpointId = req.headers['x-endpoint-id'] || 'local';
    const metadata = findStack(name, endpointId);
    if (!metadata) return res.status(404).json({ error: 'Stack not found' });

    const stackFolder = metadata.id || name;
    const stackDir = path.join(STACKS_DIR, stackFolder);
    const composePath = path.join(stackDir, 'docker-compose.yml');

    const endpoint = endpoints.get(metadata.endpointId);
    const { stdout, stderr } = await stackManager.executeCompose(
      `stop`,
      stackDir,
      endpoint,
      name // 传递 stackName
    );

    metadata.status = 'stopped';
    metadata.updatedAt = new Date().toISOString();
    saveStackMetadata(name, metadata);

    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error(`Failed to stop stack ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 重启堆栈
app.post('/api/stacks/:name/restart', async (req, res) => {
  const { name } = req.params;

  try {
    const endpointId = req.headers['x-endpoint-id'] || 'local';
    const metadata = findStack(name, endpointId);
    if (!metadata) return res.status(404).json({ error: 'Stack not found' });

    const stackFolder = metadata.id || name;
    const stackDir = path.join(STACKS_DIR, stackFolder);
    const composePath = path.join(stackDir, 'docker-compose.yml');

    const endpoint = endpoints.get(metadata.endpointId);
    const { stdout, stderr } = await stackManager.executeCompose(
      `restart`,
      stackDir,
      endpoint,
      name // 传递 stackName
    );

    metadata.updatedAt = new Date().toISOString();
    saveStackMetadata(name, metadata);

    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error(`Failed to restart stack ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 删除堆栈
app.delete('/api/stacks/:name', async (req, res) => {
  const { name } = req.params;
  const { removeVolumes, removeImages } = req.query;

  try {
    // 尝试获取元数据以确定目录
    const endpointId = req.headers['x-endpoint-id'] || 'local';
    const metadata = findStack(name, endpointId);
    const stackFolder = metadata ? (metadata.id || name) : name;
    const stackDir = path.join(STACKS_DIR, stackFolder);
    const composePath = path.join(stackDir, 'docker-compose.yml');

    // 先尝试停止并删除容器、网络
    if (fs.existsSync(composePath)) {
      let downCmd = `docker compose -f "${composePath}" down`;

      if (removeVolumes === 'true') {
        downCmd += ' -v';
      }

      if (removeImages === 'true') {
        downCmd += ' --rmi all';
      }

      try {
        // metadata 已经在上面获取了
        const endpointId = metadata ? metadata.endpointId : 'local';

        // 异步执行，等待完成
        // 异步执行，等待完成
        // 异步执行，等待完成
        const endpoint = endpoints.get(endpointId);
        // 构造临时 stack 对象以适配 stackManager
        const stackObj = { id: stackFolder, name: name };
        const cmd = `down${removeVolumes === 'true' ? ' -v' : ''}${removeImages === 'true' ? ' --rmi all' : ''}`;

        await stackManager.executeCompose(cmd, stackDir, endpoint, name);
        console.log(`Stack ${name} cleaned up successfully (containers, networks${removeVolumes === 'true' ? ', volumes' : ''})`);
      } catch (error) {
        console.error(`Cleanup error for ${name}:`, error.message);
        // 即使清理失败，也继续删除目录
      }
    }

    // 删除文件和元数据
    if (fs.existsSync(stackDir)) {
      fs.rmSync(stackDir, { recursive: true, force: true });
    }
    if (metadata) {
      stacks.delete(metadata.id);
    } else {
      // 如果没有元数据，尝试按名称删除（兼容旧数据）
      stacks.delete(name);
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete stack ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 获取堆栈 Compose 内容
app.get('/api/stacks/:name/compose', async (req, res) => {
  const { name } = req.params;
  try {
    const endpointId = req.headers['x-endpoint-id'] || 'local';
    const metadata = findStack(name, endpointId);
    if (!metadata) return res.status(404).json({ error: 'Stack not found' });

    const stackFolder = metadata.id || name;
    const stackDir = path.join(STACKS_DIR, stackFolder);
    const composePath = path.join(stackDir, 'docker-compose.yml');

    if (!fs.existsSync(composePath)) {
      return res.status(404).json({ error: 'Compose file not found' });
    }

    const content = fs.readFileSync(composePath, 'utf8');
    res.json({ content });
  } catch (error) {
    console.error(`Failed to get compose content for ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 导入外部堆栈配置
app.post('/api/stacks/:name/import-config', async (req, res) => {
  const { name } = req.params;
  const { composeContent, description } = req.body;

  console.log(`[Stack Import] Importing config for external stack: ${name}`);

  if (!composeContent) {
    return res.status(400).json({ error: 'composeContent is required' });
  }

  try {
    const currentEndpointId = req.headers['x-endpoint-id'] || 'local';

    // 使用数字ID创建目录
    // Check if stack already exists
    let stackId;
    let existingStack = Array.from(stacks.values()).find(s => s.name === name);

    if (existingStack) {
      stackId = existingStack.id;
      console.log(`[Stack Import] Updating existing stack: ${name} (${stackId})`);
    } else {
      stackId = getNextStackId();
      console.log(`[Stack Import] Creating new stack: ${name} (${stackId})`);
    }

    const stackDir = path.join(STACKS_DIR, stackId);

    // 1. 创建堆栈目录
    if (!fs.existsSync(stackDir)) {
      fs.mkdirSync(stackDir, { recursive: true });
    }

    // 2. 保存 Compose 文件
    const composePath = path.join(stackDir, 'docker-compose.yml');
    fs.writeFileSync(composePath, composeContent, 'utf8');
    console.log(`[Stack Import] Compose file saved: ${composePath}`);

    // 3. 创建元数据
    const metadata = {
      name,
      id: stackId, // 保存目录ID
      description: description || `导入的外部堆栈 ${name}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      endpointId: currentEndpointId, // 确保保存 endpointId
      status: 'running', // 外部堆栈通常已经在运行
      env: [] // 初始化空环境变量
    };

    // 4. 保存元数据
    saveStackMetadata(name, metadata);
    stacks.set(stackId, metadata);
    console.log(`[Stack Import] Metadata saved for: ${name}`);

    // 5. 自动保存为模板
    try {
      console.log(`[Stack Import] Auto-saving template for: ${name}`);
      const templateDir = path.join(TEMPLATES_DIR, name);

      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }

      // 复制 compose 文件
      const templateComposePath = path.join(templateDir, 'docker-compose.yml');
      fs.writeFileSync(templateComposePath, composeContent, 'utf8');

      // 创建模板信息
      const templateInfo = {
        name,
        title: name,
        description: description || `Imported from stack ${name}`,
        category: 'Custom',
        tags: ['Imported'],
        author: 'User',
        createdAt: new Date().toISOString(),
        composeContent // Store in memory
      };

      // 保存模板信息
      saveTemplateInfo(name, templateInfo);
      templates.set(name, templateInfo);
      console.log(`[Stack Import] Template ${name} saved successfully`);
    } catch (templateError) {
      console.error(`[Stack Import] Failed to auto-save template:`, templateError);
      // 不阻断主流程
    }



    // 6. 返回成功
    res.json({
      success: true,
      stack: {
        name,
        ...metadata,
        managed: true // 现在是托管堆栈了
      }
    });

    console.log(`[Stack Import] Import completed for: ${name}`);
  } catch (error) {
    console.error(`[Stack Import] Failed to import config for ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ========== 模板 API ==========

// 获取所有模板
app.get('/api/stacks/templates', (req, res) => {
  console.log('GET /api/stacks/templates called');
  try {
    const templateList = Array.from(templates.values()).map(t => ({
      name: t.name,
      title: t.title,
      description: t.description,
      category: t.category,
      tags: t.tags,
      author: t.author,
      createdAt: t.createdAt
    }));
    console.log(`Returning ${templateList.length} templates`);
    res.json(templateList);
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取模板详情
app.get('/api/stacks/templates/:name', (req, res) => {
  const { name } = req.params;

  try {
    const templateInfo = templates.get(name);
    if (!templateInfo) return res.status(404).json({ error: 'Template not found' });

    const composePath = path.join(TEMPLATES_DIR, name, 'docker-compose.yml');
    if (!fs.existsSync(composePath)) {
      return res.status(404).json({ error: 'Template compose file not found' });
    }

    const composeContent = fs.readFileSync(composePath, 'utf8');

    res.json({
      ...templateInfo,
      composeContent
    });
  } catch (error) {
    console.error(`Failed to get template ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 创建模板
app.post('/api/stacks/templates', (req, res) => {
  const { name, title, description, composeContent, category, tags, author } = req.body;
  console.log('POST /api/stacks/templates called, name:', name);

  if (!name || !composeContent) {
    return res.status(400).json({ error: 'Name and composeContent required' });
  }

  try {
    // 检查模板是否已存在
    if (templates.has(name)) {
      return res.status(409).json({ error: 'Template already exists' });
    }

    const templateDir = path.join(TEMPLATES_DIR, name);

    // 创建模板目录
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    // 保存 Compose 文件
    const composePath = path.join(templateDir, 'docker-compose.yml');
    fs.writeFileSync(composePath, composeContent, 'utf8');

    // 创建模板信息
    const templateInfo = {
      name,
      title: title || name,
      description: description || '',
      category: category || 'Custom',
      tags: tags || [],
      author: author || 'User',
      createdAt: new Date().toISOString()
    };

    // 保存模板信息
    saveTemplateInfo(name, templateInfo);
    templates.set(name, templateInfo);

    console.log(`Template '${name}' created successfully. Total templates: ${templates.size}`);
    res.json({ success: true, template: templateInfo });
  } catch (error) {
    console.error('Failed to create template:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新模板
app.put('/api/stacks/templates/:name', (req, res) => {
  const { name } = req.params;
  const { title, description, composeContent, category, tags } = req.body;

  try {
    const templateInfo = templates.get(name);
    if (!templateInfo) return res.status(404).json({ error: 'Template not found' });

    // 更新模板信息
    if (title) templateInfo.title = title;
    if (description !== undefined) templateInfo.description = description;
    if (category) templateInfo.category = category;
    if (tags) templateInfo.tags = tags;

    // 更新 Compose 文件
    if (composeContent) {
      const composePath = path.join(TEMPLATES_DIR, name, 'docker-compose.yml');
      fs.writeFileSync(composePath, composeContent, 'utf8');
    }

    saveTemplateInfo(name, templateInfo);
    res.json({ success: true, template: templateInfo });
  } catch (error) {
    console.error(`Failed to update template ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 删除模板
app.delete('/api/stacks/templates/:name', (req, res) => {
  const { name } = req.params;

  try {
    const templateDir = path.join(TEMPLATES_DIR, name);

    if (fs.existsSync(templateDir)) {
      fs.rmSync(templateDir, { recursive: true, force: true });
    }
    templates.delete(name);

    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete template ${name}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 从模板部署堆栈


// 所有其他请求返回 index.html (支持前端路由)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== 启动服务器 ====================

const PORT = process.env.PORT || 9000;

// 自动获取宿主机IP
async function updateLocalIp() {
  try {
    const os = require('os');
    const containerId = os.hostname();

    // 1. 获取当前容器信息以拿到镜像名
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    const imageName = info.Config.Image;

    console.log(`Detecting host IP using image: ${imageName}`);

    // 2. 运行临时容器获取宿主机IP
    // 使用 ip route get 1.1.1.1 获取路由信息，解析 src 字段
    const cmd = ['sh', '-c', "ip route get 1.1.1.1 | grep -oP 'src \\K\\S+'"];

    const chunks = [];
    const stream = new require('stream').Writable({
      write(chunk, encoding, next) {
        chunks.push(chunk);
        next();
      }
    });

    await docker.run(imageName, cmd, stream, {
      HostConfig: { AutoRemove: true, NetworkMode: 'host' }
    });

    const output = Buffer.concat(chunks).toString().trim();

    if (output && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(output)) {
      console.log(`Detected Host IP: ${output}`);

      // 更新本地节点配置
      const endpoints = loadEndpoints();
      const local = endpoints.get('local');
      if (local && local.host !== output) {
        local.host = output;
        endpoints.set('local', local);
        saveEndpoints(endpoints);
        console.log('Updated local endpoint host IP');
      }
    } else {
      console.warn('Failed to parse host IP from output:', output);
    }
  } catch (error) {
    console.error('Failed to auto-detect host IP:', error.message);
  }
}

// 启动时尝试获取IP
// if (process.env.DMA_MODE !== 'agent') {
//   setTimeout(updateLocalIp, 5000);
// }

// Only start the Manager server if NOT in agent mode
if (process.env.DMA_MODE !== 'agent') {
  server.listen(PORT, () => {
    console.log(`DMA Server running on port ${PORT}`);
  });
} else {
  console.log('DMA Server (Manager) disabled in Agent mode');
}

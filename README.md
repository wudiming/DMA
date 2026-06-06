# DMA - Docker Manager App

一个现代化、美观的 Docker 管理平台，融合了 Unraid、Dpanel 和 Portainer 的优秀特性。

## ✨ 功能特性

- 🎨 **现代化 UI 设计**：玻璃态 + 渐变色，支持深色/浅色模式
- 🌍 **多语言支持**：中文/英文无缝切换
- 📊 **系统概览**：实时监控 CPU、内存、网络和磁盘使用情况
- 🐳 **容器管理**：Unraid 风格交互，支持一键更新、日志查看、终端连接
- 🛠️ **高级容器配置**：支持 Entrypoint、CMD、Capabilities（复选框）、Devices、Sysctls 等高级参数，并自动保存为用户模板
- 📝 **Docker 命令解析**：支持将复杂 `docker run` 命令（含 WebUI/Icon 标签、Entrypoint、CMD 参数）一键转为表单
- 🌐 **WebUI 快速访问**：自动根据节点 IP 和端口映射填充 WebUI 地址
- 🤖 **Agent 远程管理**：通过安全的 Agent 模式管理远程 Docker 节点
- 🔄 **自我更新**：支持一键更新 DMA 自身
- 🖼️ **镜像管理**：拉取、删除、更新后自动清理旧版本镜像（单容器/编排统一策略）
- 📦 **Compose 编排**：支持在线编辑和部署 Docker Compose
- 💾 **存储卷管理**：创建、删除和查看卷详情
- 🌐 **网络管理**：管理 Docker 网络


## 🚀 快速开始

### 1. 部署管理端 (Manager)


```bash
docker run -d \
  --name dma \
  --restart always \
  -p 9000:9000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/dma/data:/app/data \
  -e LOGIN_USER="myuser" \
  -e LOGIN_PASSWORD="mypassword" \
  wudiming/dma:latest
```

访问地址：`http://localhost:9000`

### 2. 部署远程 Agent

在远程服务器上运行以下命令，将其作为受控节点：

```bash
docker run -d \
  --name dma-agent \
  --restart always \
  -p 9002:9002 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e DMA_MODE=agent \
  -e DMA_SECRET=您的密钥 \
  wudiming/dma:latest
```

然后在 DMA 管理端添加节点：
- **Secret Key**：您设置的密钥

## 🔐 登录说明

默认登录账户：
- **用户名**：`admin`
- **密码**：`admin`

建议首次登录后通过环境变量修改默认密码。

## ⚙️ 环境变量说明

DMA 支持通过环境变量进行灵活配置，以下是支持的变量列表：

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PORT` | `9000` | Web 界面访问端口 |
| `DMA_MODE` | `manager` | 运行模式，可选 `manager` (管理端) 或 `agent` (被控端) |
| `DMA_SECRET` | - | Agent 模式下的连接密钥，用于安全认证 |
| `LOGIN_USER` | `admin` | 自定义登录用户名 |
| `LOGIN_PASSWORD` | `admin` | 自定义登录密码 |

## 📚 模板库变量使用说明


这是一个更实用的多节点部署案例。假设您要在不同的节点上部署一套 Web 服务，每个节点需要监听不同的端口，并且连接的数据库密码也不同。

**Docker Compose (YAML):**

```yaml
version: '3.8'

services:
  # Web 应用服务
  webapp:
    image: my-webapp:${APP_VERSION}  # 镜像版本可配
    ports:
      - "${WEB_PORT}:80"             # 主机端口可配，避免冲突
    environment:
      - DB_HOST=db
      - DB_PASSWORD=${DB_PASSWORD}   # 数据库密码可配
      - NODE_ID=${NODE_ID}           # 节点标识可配
    depends_on:
      - db
    restart: always

  # 数据库服务
  db:
    image: mysql:5.7
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD} # 与 WebApp 使用相同的密码变量
      - MYSQL_DATABASE=myapp
    volumes:
      - db_data:/var/lib/mysql
    restart: always

volumes:
  db_data:
```


通过这种方式，您只需维护一个模板，就可以在无限个节点上部署出配置各异的服务实例，完美适应开发、测试和生产环境。

## 🛠️ 本地开发

```bash
cd server
npm install
# 默认运行在 9001 (API) 和 9000 (Web)
npm run dev
```

### 前端 (Client)

```bash
cd client
npm install
# 默认运行在 9000 端口，代理指向 9001
npm run dev
```

### Agent 调试

```bash
cd server
# 启动 Agent 模式 (端口 9002)
DMA_MODE=agent DMA_SECRET=test npm run dev
```

## 📦 技术栈

- **前端**: React + Vite + TailwindCSS + i18next + Zustand
- **后端**: Node.js + Express + dockerode + WebSocket
- **部署**: Docker (Multi-stage build)

## 🚢 自动发布和 Docker 镜像

本项目已配置 GitHub Actions 自动化工作流，支持：
- ✅ 自动构建多平台 Docker 镜像（amd64 + arm64）
- ✅ 推送到 Docker Hub
- ✅ 自动创建 GitHub Release 和生成 changelog

### 发布新版本

当您准备发布新版本时，只需创建并推送一个 git tag：

```bash
# 创建版本标签
git tag v1.0.0

# 推送到 GitHub
git push origin v1.0.0
```

推送后，GitHub Actions 会自动：
1. 构建多平台 Docker 镜像
2. 推送到 Docker Hub，带有以下标签：
   - `latest` - 最新版本
   - `v1.0.0` - 完整版本号
3. 在 GitHub 上创建 Release 并自动生成更新日志

### Docker Hub 镜像

```bash
# 拉取最新版本
docker pull wudiming/dma:latest

# 拉取指定版本
docker pull wudiming/dma:v1.0.0
```

### 配置说明

如果您 fork 了本项目并希望启用自动发布功能，请参阅 [GitHub Secrets 配置指南](.github/SECRETS_SETUP.md)。

## 📄 许可证

MIT

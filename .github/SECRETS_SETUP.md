# GitHub Secrets 配置指南

本项目的自动发布工作流需要配置 Docker Hub 相关的密钥。

## 步骤 1: 获取 Docker Hub Access Token

1. 登录 [Docker Hub](https://hub.docker.com/)
2. 点击右上角头像 → **Account Settings**
3. 在左侧菜单中找到 **Security** 选项
4. 点击 **New Access Token** 按钮
5. 填写以下信息：
   - **Access Token Description**: 例如 "GitHub Actions DMA"
   - **Access permissions**: 选择 **Read, Write, Delete**
6. 点击 **Generate** 生成令牌
7. **重要**: 复制并保存显示的 Access Token（只会显示一次）

## 步骤 2: 在 GitHub 仓库中添加 Secrets

1. 打开您的 GitHub 仓库页面: https://github.com/wudiming/DMA
2. 点击仓库顶部的 **Settings** 标签
3. 在左侧菜单中找到 **Secrets and variables** → 点击 **Actions**
4. 点击右侧的 **New repository secret** 按钮

### 添加第一个 Secret: DOCKERHUB_USERNAME

1. **Name**: 输入 `DOCKERHUB_USERNAME`
2. **Secret**: 输入您的 Docker Hub 用户名
3. 点击 **Add secret** 保存

### 添加第二个 Secret: DOCKERHUB_TOKEN

1. 再次点击 **New repository secret** 按钮
2. **Name**: 输入 `DOCKERHUB_TOKEN`
3. **Secret**: 粘贴在步骤 1 中复制的 Access Token
4. 点击 **Add secret** 保存

## 步骤 3: 验证配置

配置完成后，您应该在 **Repository secrets** 列表中看到两个密钥：
- ✅ DOCKERHUB_USERNAME
- ✅ DOCKERHUB_TOKEN

## 如何使用自动发布功能

配置完成后，每次您推送带有 `v` 前缀的 tag 时，就会自动触发发布流程：

```bash
# 示例：发布 v0.9.16 版本
git tag v0.9.16
git push origin v0.9.16
```

工作流会自动：
1. ✅ 构建多平台 Docker 镜像（amd64 + arm64）
2. ✅ 推送到 Docker Hub（带 latest 和版本号标签）
3. ✅ 创建 GitHub Release 并生成 changelog

## 镜像使用

发布后，您可以通过以下方式拉取镜像：

```bash
# 拉取最新版本
docker pull your-dockerhub-username/dma:latest

# 拉取特定版本
docker pull your-dockerhub-username/dma:v0.9.16
```

## 故障排除

如果工作流失败，请检查：
1. Docker Hub 用户名是否正确
2. Access Token 是否有效且具有正确的权限
3. Secret 名称是否完全匹配（区分大小写）

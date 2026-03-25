#!/bin/bash
# BioMentor 3M 一键部署脚本
# 用法: bash scripts/deploy.sh

SERVER="root@117.72.75.45"
REMOTE_DIR="/opt/BioMentor_3M"

echo "=== BioMentor 3M Deploy ==="

# 1. 测试连接
echo "[1/5] Testing SSH connection..."
ssh -o ConnectTimeout=10 "$SERVER" "echo 'SSH OK'" || {
    echo "SSH connection failed. Make sure:"
    echo "  - Proxy/VPN is OFF"
    echo "  - You can reach the server"
    exit 1
}

# 2. 确保远程目录存在 & 安装 Node.js
echo "[2/5] Preparing server..."
ssh "$SERVER" << 'SETUP'
mkdir -p /opt/BioMentor_3M
if ! command -v node &>/dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node: $(node -v)"
echo "npm: $(npm -v)"
SETUP

# 3. 同步文件（排除不需要的文件）
echo "[3/5] Syncing files..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude '*.png' \
    --exclude '*.copy.html' \
    --exclude 'scripts/deploy.sh' \
    ./ "$SERVER:$REMOTE_DIR/"

# 4. 远程安装依赖 & 配置环境
echo "[4/5] Installing dependencies..."
ssh "$SERVER" << INSTALL
cd $REMOTE_DIR
npm install --production

# 创建 .env（如果不存在）
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit /opt/BioMentor_3M/.env with your API keys"
fi
INSTALL

# 5. 启动/重启服务
echo "[5/5] Starting service..."
ssh "$SERVER" << 'START'
cd /opt/BioMentor_3M

# 停掉旧进程
pkill -f "node server.js" 2>/dev/null
sleep 1

# 用 nohup 后台运行
nohup node server.js > /var/log/biomentor.log 2>&1 &
sleep 2

# 确认运行
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ BioMentor 3M is running!"
    echo "   URL: http://117.72.75.45:3000"
    echo "   3M Framework: http://117.72.75.45:3000/3m/"
    echo "   Logs: /var/log/biomentor.log"
else
    echo "❌ Failed to start. Check logs:"
    tail -20 /var/log/biomentor.log
fi
START

echo "=== Deploy complete ==="

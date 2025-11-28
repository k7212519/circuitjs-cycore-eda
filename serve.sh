#!/bin/bash
set -euo pipefail

# 检查site目录是否存在
if [ ! -d "site" ]; then
    echo "错误: site 目录不存在"
    echo "请先运行 ./dev.sh 或 ./build.sh 进行构建"
    exit 1
fi

PORT=${1:-8080}

echo "========================================="
echo "启动本地开发服务器"
echo "========================================="
echo ""
echo "服务器地址: http://127.0.0.1:$PORT"
echo "按 Ctrl+C 停止服务器"
echo ""

cd site

# 尝试使用python3启动HTTP服务器
if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer $PORT
else
    echo "错误: 未找到 python 或 python3"
    echo "请安装 Python 或使用其他 Web 服务器"
    exit 1
fi

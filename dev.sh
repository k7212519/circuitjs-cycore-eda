#!/bin/bash
set -euo pipefail

echo "========================================="
echo "GWT Development Mode Build"
echo "========================================="
echo ""

# 使用开发模式编译GWT项目
# compileGwtDev任务会自动配置调试友好的编译选项：
# - 代码风格: PRETTY (不混淆，保持可读性)
# - Draft编译: 启用 (加快编译速度)
# - 类元数据: 保留 (便于调试)
# - 类型检查: 保留 (便于调试)
gradle compileGwtDev

echo ""
echo "Creating site directory..."
gradle makeSite

echo ""
echo "========================================="
echo "✓ 开发构建完成！"
echo "========================================="
echo ""
echo "部署位置: ./site"
echo "启动方式: 在浏览器中打开 ./site/circuitjs.html"
echo ""
echo "调试提示:"
echo "  1. 打开浏览器开发者工具 (F12)"
echo "  2. JavaScript代码未混淆，函数名和变量名保持原样"
echo "  3. 可以在Sources面板中查看和调试源代码"
echo "  4. 建议使用本地Web服务器，避免CORS问题:"
echo "     cd site && python3 -m http.server 8080"
echo ""

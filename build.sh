#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

gradle makeSite "$@"
echo "发布目录: $(pwd)/site（完整上传，包含 circuit/ 子目录）"

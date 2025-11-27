#!/bin/sh

# 定义端口
PORT=45775

# 定义您的工作目录 (根据您当前所在的路径)
WORK_DIR="/home/wenxiu778899/domains/9526.ip-ddns.com/public_html"
ENTRY_POINT="index.js"

# 检查端口是否被监听
sockstat -4 -l | grep ":$PORT" > /dev/null

if [ $? -ne 0 ]; then
    # 如果端口没在监听，记录日志并启动
    echo "$(date): 服务未运行，正在启动..." >> "$WORK_DIR/restart.log"
    cd "$WORK_DIR"
    # 后台启动
    /usr/local/bin/node "$ENTRY_POINT" > server.log 2>&1 &
fi
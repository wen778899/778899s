// 核心修复：强制 Node.js 进程使用北京时间
process.env.TZ = 'Asia/Shanghai';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const startBot = require('./bot');

const app = express();
const PORT = process.env.PORT || 45775;

app.use(cors({
    origin: ['https://88.9526.ip-ddns.com', 'http://localhost:5173'],
    methods: ['GET']
}));
app.use(express.json());

// API: 获取最新一期
app.get('/api/latest', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        if (rows.length === 0) return res.json({ success: false, message: '暂无数据' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// API: 获取历史记录
app.get('/api/history', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT issue, open_date, numbers, special_code, shengxiao, next_prediction, deep_prediction FROM lottery_results ORDER BY issue DESC LIMIT 50');
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 API Server running on port ${PORT} (TZ: Asia/Shanghai)`);
    // 启动 Bot
    startBot();
});

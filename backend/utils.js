const express = require('express');
const path = require('path');
const db = require('./db');
const { generateDeterministicPrediction } = require('./prediction-algorithm');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==================== 路由 ====================

// 首页
app.get('/', async (req, res) => {
    try {
        const [latest] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        const [recent] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 10');
        const [stats] = await db.query('SELECT COUNT(*) as total, MIN(issue) as first, MAX(issue) as last FROM lottery_results');
        
        let prediction = null;
        if (latest[0]?.next_prediction) {
            prediction = JSON.parse(latest[0].next_prediction);
        } else if (latest[0]) {
            const [history] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
            prediction = generateDeterministicPrediction(history);
        }
        
        res.render('index', {
            title: '澳门六合彩智能预测系统',
            prediction,
            latest: latest[0],
            recent,
            stats: stats[0],
            version: 'V16.0'
        });
    } catch (error) {
        console.error('Home error:', error);
        res.render('error', { message: '加载数据失败' });
    }
});

// 预测页面
app.get('/prediction', async (req, res) => {
    try {
        const [history] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
        const prediction = generateDeterministicPrediction(history);
        
        res.json({
            success: true,
            data: prediction,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 历史数据
app.get('/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const [data] = await db.query(
            'SELECT * FROM lottery_results ORDER BY issue DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
        
        const [total] = await db.query('SELECT COUNT(*) as count FROM lottery_results');
        
        res.json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total: total[0].count,
                pages: Math.ceil(total[0].count / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 统计分析
app.get('/stats', async (req, res) => {
    try {
        const [history] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 100');
        
        if (history.length === 0) {
            return res.json({ success: true, data: { message: '暂无数据' } });
        }
        
        const stats = {
            numberFrequency: {},
            zodiacFrequency: {},
            patternStats: {
                head: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
                tail: {},
                oddEven: { odd: 0, even: 0 },
                size: { large: 0, small: 0 }
            }
        };
        
        history.forEach(record => {
            let numbers = [];
            try {
                numbers = JSON.parse(record.numbers);
            } catch {
                numbers = record.numbers.split(',').map(Number);
            }
            
            const allNumbers = [...numbers, parseInt(record.special_code)];
            
            allNumbers.forEach(num => {
                // 号码频率
                stats.numberFrequency[num] = (stats.numberFrequency[num] || 0) + 1;
                
                // 头尾统计
                const head = Math.floor(num / 10);
                const tail = num % 10;
                stats.patternStats.head[head] = (stats.patternStats.head[head] || 0) + 1;
                stats.patternStats.tail[tail] = (stats.patternStats.tail[tail] || 0) + 1;
                
                // 奇偶
                if (num % 2 === 1) stats.patternStats.oddEven.odd++;
                else stats.patternStats.oddEven.even++;
                
                // 大小
                if (num > 24) stats.patternStats.size.large++;
                else stats.patternStats.size.small++;
            });
        });
        
        // 热门号码
        const hotNumbers = Object.entries(stats.numberFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([num, count]) => ({ num: parseInt(num), count }));
        
        // 冷门号码
        const coldNumbers = Object.entries(stats.numberFrequency)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 20)
            .map(([num, count]) => ({ num: parseInt(num), count }));
        
        res.json({
            success: true,
            data: {
                hotNumbers,
                coldNumbers,
                patternStats: stats.patternStats,
                totalRecords: history.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 期号查询
app.get('/search/:issue', async (req, res) => {
    try {
        const issue = req.params.issue;
        const [data] = await db.query('SELECT * FROM lottery_results WHERE issue = ?', [issue]);
        
        if (data.length === 0) {
            return res.json({ success: false, error: '未找到该期号' });
        }
        
        res.json({ success: true, data: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API文档
app.get('/api-docs', (req, res) => {
    res.render('api-docs', {
        title: 'API文档',
        endpoints: [
            { method: 'GET', path: '/api/prediction', desc: '获取最新预测' },
            { method: 'GET', path: '/api/history?page=1&limit=20', desc: '获取历史数据' },
            { method: 'GET', path: '/api/stats', desc: '获取统计信息' },
            { method: 'GET', path: '/api/search/{issue}', desc: '查询指定期号' }
        ]
    });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

app.use((req, res) => {
    res.status(404).render('error', { message: '页面不存在' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🌐 网站服务器运行在 http://localhost:${PORT}`);
});

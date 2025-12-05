const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00'
});

const promisePool = pool.promise();

// 初始化数据库表结构
async function initDB() {
    try {
        // 1. 开奖结果表
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS lottery_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                issue VARCHAR(20) NOT NULL UNIQUE,
                open_date DATETIME,
                numbers JSON,
                special_code INT,
                shengxiao VARCHAR(10),
                next_prediction JSON,
                deep_prediction JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. [新增] 规律统计记忆表
        // key_type: 统计维度 (如: PREV_ZODIAC, PREV_TAIL)
        // key_value: 维度值 (如: 牛, 7)
        // stats_data: 统计结果 JSON { "鼠": 10, "牛": 5... }
        // total_samples: 样本总数
        await promisePool.execute(`
            CREATE TABLE IF NOT EXISTS lottery_patterns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_type VARCHAR(50) NOT NULL,
                key_value VARCHAR(50) NOT NULL,
                stats_data JSON,
                total_samples INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_pattern (key_type, key_value)
            )
        `);

        console.log('✅ 数据库表结构初始化完成');
    } catch (err) {
        console.error('❌ 数据库初始化失败:', err);
    }
}

// 启动时检查
initDB();

module.exports = promisePool;

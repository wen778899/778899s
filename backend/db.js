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
  timezone: '+08:00' // 强制北京时间
});

// 错误监听
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1); // 遇到致命错误重启进程
});

// 导出 promise 包装器
const promisePool = pool.promise();

// 初始化检查
(async () => {
    try {
        const [rows] = await promisePool.query('SELECT 1');
        console.log('✅ 数据库连接成功');
    } catch (err) {
        console.error('❌ 数据库连接失败:', err.message);
    }
})();

module.exports = promisePool;

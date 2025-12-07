const mysql = require('mysql2');
require('dotenv').config();

// 创建连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00', // 强制北京时间
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 监听错误，防止连接断开导致崩溃
pool.on('error', (err) => {
  console.error('🔥 DB Pool Error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 DB Connection lost. Reconnecting...');
  } else {
    // 遇到严重数据库错误，重启进程
    process.exit(1);
  }
});

const promisePool = pool.promise();

// 启动时测试连接
(async () => {
    try {
        await promisePool.query('SELECT 1');
        console.log('✅ MySQL Connected');
    } catch (err) {
        console.error('❌ MySQL Connection Failed:', err.message);
        process.exit(1); // 连不上数据库直接退出，让守护脚本重启
    }
})();

module.exports = promisePool;

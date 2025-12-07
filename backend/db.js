const mysql = require('mysql2');
require('dotenv').config();

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // 核心设置：强制数据库时间为北京时间，避免服务器时区干扰
  timezone: '+08:00',
  // 保持连接活跃
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 监听连接错误 (防止空闲连接断开导致崩溃)
pool.on('error', (err) => {
  console.error('❌ Database Pool Error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Connection lost, attempting to reconnect...');
  } else {
    // 遇到严重错误时，让进程重启以恢复连接
    process.exit(-1);
  }
});

// 导出 Promise 包装器，方便使用 async/await
const promisePool = pool.promise();

// 启动时立即测试连接
(async () => {
    try {
        const [rows] = await promisePool.query('SELECT 1 as val');
        console.log('✅ 数据库连接成功 (MySQL)');
    } catch (err) {
        console.error('❌ 数据库连接失败:', err.message);
        console.error('   请检查 .env 文件中的 DB_HOST, DB_USER, DB_PASSWORD 配置');
    }
})();

module.exports = promisePool;

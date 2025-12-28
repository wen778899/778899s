require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('正在连接数据库...');

        // 1. 创建玩家表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                balance INT DEFAULT 1000,
                wins INT DEFAULT 0,
                losses INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ 玩家表 (players) 已就绪');

        // 2. 创建游戏记录表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS game_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                player_id INT,
                winner VARCHAR(20),
                player_score INT,
                cpu_score INT,
                played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players(id)
            )
        `);
        console.log('✅ 游戏历史表 (game_history) 已就绪');

        console.log('🎉 所有数据表初始化成功！');
    } catch (error) {
        console.error('❌ 初始化失败:', error.message);
    } finally {
        await connection.end();
    }
}

setupDatabase();

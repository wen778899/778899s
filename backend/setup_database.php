<?php
// 该脚本用于初始化数据库表结构
echo "数据库初始化脚本...\n";

// 引入数据库配置文件
require_once 'config/database.php';

try {
    $pdo = getDBConnection();
    echo "数据库连接成功。\n";

    $sql = "
    CREATE TABLE IF NOT EXISTS `users` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `public_id` VARCHAR(4) NOT NULL UNIQUE,
        `phone` VARCHAR(20) NOT NULL UNIQUE,
        `password_hash` VARCHAR(255) NOT NULL,
        `points` BIGINT DEFAULT 1000,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS `pre_generated_hands` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `hand_data` JSON NOT NULL,
        `is_used` BOOLEAN DEFAULT FALSE,
        `used_at` DATETIME NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `is_used_idx` (`is_used`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS `games` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `room_id` VARCHAR(36) NOT NULL,
        `score_type` INT NOT NULL,
        `hand_id` INT,
        `players_data` JSON,
        `status` VARCHAR(20) DEFAULT 'playing',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `finished_at` DATETIME NULL,
        FOREIGN KEY (`hand_id`) REFERENCES `pre_generated_hands`(`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS `points_transfer_log` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `from_user_id` INT NOT NULL,
        `to_user_id` INT NOT NULL,
        `amount` BIGINT NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`),
        FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    $pdo->exec($sql);
    echo "所有数据表创建成功或已存在。\n";

} catch (PDOException $e) {
    die("数据库操作失败: " . $e->getMessage() . "\n");
}
<?php
require_once 'config.php';

try {
    // DSN for initial connection without specifying a database
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create the database if it doesn't exist
    $pdo->exec("CREATE DATABASE IF NOT EXISTS " . DB_NAME);
    $pdo->exec("USE " . DB_NAME);
    echo "数据库 '" . DB_NAME . "' 连接或创建成功!\n";

    // --- Create users table ---
    $sql_users = ""
    CREATE TABLE IF NOT EXISTS `users` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `public_id` VARCHAR(4) NOT NULL UNIQUE,
        `phone_number` VARCHAR(20) NOT NULL UNIQUE,
        `password_hash` VARCHAR(255) NOT NULL,
        `points` INT NOT NULL DEFAULT 1000,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """;
    $pdo->exec($sql_users);
    echo "表 'users' 创建或检查成功!\n";

    // --- Create point_transfers table ---
    $sql_transfers = ""
    CREATE TABLE IF NOT EXISTS `point_transfers` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `sender_id` INT NOT NULL,
        `receiver_id` INT NOT NULL,
        `amount` INT NOT NULL,
        `transfer_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """;
    $pdo->exec($sql_transfers);
    echo "表 'point_transfers' 创建或检查成功!\n";

    // --- Create/Update game_records table (keeping existing logic) ---
    $sql_game_records = ""
    CREATE TABLE IF NOT EXISTS `game_records` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `player_score` int(11) NOT NULL,
      `cpu_score` int(11) NOT NULL,
      `winner` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
      `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
       PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    """;
    $pdo->exec($sql_game_records);
    echo "表 'game_records' 创建或检查成功!\n";

    echo "\n数据库设置完成!\n";

} catch (PDOException $e) {
    die("数据库设置错误: " . $e->getMessage());
}

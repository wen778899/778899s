<?php

// --- .env 文件加载器 ---
$env_path = __DIR__ . '/.env';
if (file_exists($env_path)) {
    $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // 跳过注释
        if (strpos(trim($line), '#') === 0) {
            continue;
        }

        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);

        // 定义为常量
        if (!defined($name)) {
            define($name, $value);
        }
    }
}

// --- 数据库配置 (从 .env 加载) ---
define('DB_HOST', defined('DB_HOST') ? DB_HOST : 'localhost');
define('DB_PORT', defined('DB_PORT') ? DB_PORT : 3306);
define('DB_NAME', defined('DB_NAME') ? DB_NAME : 'shisan'); 
define('DB_USER', defined('DB_USER') ? DB_USER : 'root');     
define('DB_PASS', defined('DB_PASSWORD') ? DB_PASSWORD : 'password');

// --- CORS 配置 ---

// 允许跨域访问的前端地址
$allowed_origins = [
    'https://88.9526.ip-ddns.com',
    'http://localhost:5173',
    'http://localhost:8080'
];

// CORS 头设置
if (isset($_SERVER['HTTP_ORIGIN'])) {
    $origin = $_SERVER['HTTP_ORIGIN'];
    // 允许来自 Cloudflare Pages 的所有子域名
    if (in_array($origin, $allowed_origins) || preg_match('/\.pages\.dev$/', $origin)) {
        header("Access-Control-Allow-Origin: " . $origin);
    }
}

header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

// 响应 OPTIONS 预检请求
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}


backend/utils/response.php<?php
// 解析.env文件并返回数据库连接
function getDBConnection() {
    // Serv00的.env文件通常在家目录
    $envPath = '/home/' . get_current_user() . '/.env';
    
    if (!file_exists($envPath)) {
        throw new Exception(".env file not found at " . $envPath);
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $config = [];
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        list($name, $value) = explode('=', $line, 2);
        $config[trim($name)] = trim($value);
    }
    
    $host = $config['DB_HOST'] ?? 'localhost';
    $dbname = $config['DB_NAME'] ?? '';
    $user = $config['DB_USER'] ?? '';
    $pass = $config['DB_PASS'] ?? '';
    $charset = 'utf8mb4';

    $dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        return new PDO($dsn, $user, $pass, $options);
    } catch (PDOException $e) {
        throw new PDOException($e->getMessage(), (int)$e->getCode());
    }
}

function getEnvVariable($key) {
    $envPath = '/home/' . get_current_user() . '/.env';
    if (!file_exists($envPath)) return null;

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        if (trim($name) === $key) {
            // 移除可能存在的引号
            return trim(trim($value), '"\'');
        }
    }
    return null;
}
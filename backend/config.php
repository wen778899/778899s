<?php
// backend/config.php
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// 定义前端域名
define('FRONTEND_ORIGIN', 'https://88.9526.ip-ddns.com'); // 注意这里改成 https

function handle_cors() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // 允许的来源列表
    $allowed_origins = [
        FRONTEND_ORIGIN,
        'http://localhost:5173',
        'http://localhost',
        'capacitor://localhost'
    ];

    // 如果通过 Cloudflare Worker 代理，HTTP_ORIGIN 可能是前端域名
    // 我们总是允许
    if (in_array($origin, $allowed_origins) || empty($origin)) {
        if (!empty($origin)) {
            header("Access-Control-Allow-Origin: $origin");
        }
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
    }

    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
            header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
            header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
        exit(0);
    }
}

function get_db_connection() {
    static $pdo = null;
    if ($pdo === null) {
        // 读取 .env
        $envPath = __DIR__ . '/.env';
        if (!file_exists($envPath)) {
             // 如果找不到 .env，尝试上级目录或者报错
             // 针对 serv00 路径可能是 /home/user/domains/domain/public_html/backend/.env
             die(json_encode(['status'=>'error', 'message'=>'Config file not found']));
        }
        $env = parse_ini_file($envPath);
        
        $host = $env['DB_HOST'] ?? 'localhost';
        $port = $env['DB_PORT'] ?? '3306';
        $db   = $env['DB_DATABASE'] ?? '';
        $user = $env['DB_USERNAME'] ?? '';
        $pass = $env['DB_PASSWORD'] ?? '';

        $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }
    return $pdo;
}
?>
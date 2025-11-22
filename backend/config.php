<?php
// backend/config.php
ini_set('display_errors', 0); // 生产环境关闭回显，避免破坏 JSON
ini_set('log_errors', 1);
error_reporting(E_ALL);

// 定义前端域名，用于 CORS
define('FRONTEND_ORIGIN', 'http://88.9526.ip-ddns.com');

function handle_cors() {
    // 允许的来源列表
    $allowed_origins = [
        FRONTEND_ORIGIN,
        'http://localhost:5173', // 本地开发
        'http://localhost',      // 安卓模拟器
        'capacitor://localhost'  // 打包后的APP
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, $allowed_origins)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
    }

    // 处理预检请求
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
            header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
            header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
        exit(0);
    }
}

// 数据库连接
function get_db_connection() {
    static $pdo = null;
    if ($pdo === null) {
        // 读取 .env 文件
        $envPath = __DIR__ . '/.env';
        if (!file_exists($envPath)) {
            die(json_encode(['status'=>'error', 'message'=>'.env file not found']));
        }
        $env = parse_ini_file($envPath);
        
        $host = $env['DB_HOST'];
        $port = $env['DB_PORT'];
        $db   = $env['DB_DATABASE'];
        $user = $env['DB_USERNAME'];
        $pass = $env['DB_PASSWORD'];

        $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
        try {
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
        } catch (PDOException $e) {
            // 不要输出具体错误，防止泄露密码
            die(json_encode(['status'=>'error', 'message'=>'Database Connection Error']));
        }
    }
    return $pdo;
}
?>
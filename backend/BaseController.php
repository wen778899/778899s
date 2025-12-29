<?php
abstract class BaseController {
    protected $pdo;

    public function __construct() {
        // 使用 config.php 中定义的常量
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        try {
            $this->pdo = new PDO($dsn, DB_USER, DB_PASS);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => '数据库连接失败。']);
            exit;
        }
    }

    // 辅助函数，用于从授权头中获取当前用户
    protected function getAuthenticatedUser() {
        if (!isset($_SERVER['HTTP_AUTHORIZATION'])) {
            return null;
        }

        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        @list(,$token) = explode(' ', $authHeader);
        if(!$token) return null;

        $decoded = json_decode(base64_decode($token), true);
        
        if (!$decoded || !isset($decoded['user_id']) || (isset($decoded['expires']) && $decoded['expires'] < time())) {
            return null;
        }

        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$decoded['user_id']]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}

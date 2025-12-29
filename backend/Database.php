<?php
require_once 'config.php';

class Database {
    private static $instance = null;
    private $conn;

    private function __construct() {
        try {
            $this->conn = new PDO(
                "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4", 
                DB_USER, 
                DB_PASS
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (PDOException $e) {
            // 在生产环境中，应该记录错误而不是直接显示
            die("Database connection failed: " . $e->getMessage());
        }
    }

    public static function getInstance() {
        if (!self::$instance) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->conn;
    }
    
    // 保存对战记录
    public function saveRecord($player_score, $cpu_score, $winner) {
        $sql = "INSERT INTO game_records (player_score, cpu_score, winner) VALUES (:player_score, :cpu_score, :winner)";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            ':player_score' => $player_score,
            ':cpu_score' => $cpu_score,
            ':winner' => $winner
        ]);
    }

    // 获取统计数据
    public function getStats() {
        $stmt = $this->conn->query("SELECT COUNT(*) as total, SUM(CASE WHEN winner = 'Player' THEN 1 ELSE 0 END) as wins FROM game_records");
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}

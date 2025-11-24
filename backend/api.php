<?php
require_once 'utils/Env.php';
require_once 'utils/Db.php';
require_once 'utils/ZodiacManager.php';
require_once 'utils/LotteryLogic.php';
require_once 'utils/Settings.php';

Env::load(__DIR__ . '/.env');

$allowed_origin = $_ENV['FRONTEND_URL'];
header("Access-Control-Allow-Origin: " . $allowed_origin);
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$action = $_GET['action'] ?? '';

try {
    $pdo = Db::connect();

    if ($action === 'get_data') {
        // 1. 获取历史记录
        $stmt = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 50");
        $history = $stmt->fetchAll();

        // 格式化数据
        $processedHistory = [];
        foreach ($history as $row) {
            $nums = [];
            for($i=1; $i<=6; $i++) $nums[] = ZodiacManager::getInfo($row["n$i"]);
            $specInfo = ZodiacManager::getInfo($row['spec']);
            
            $processedHistory[] = [
                'id' => $row['id'],
                'issue' => $row['issue'],
                'normals' => $nums,
                'spec' => $specInfo,
                'created_at' => $row['created_at']
            ];
        }

        // 2. 获取或计算预测
        // 优先读取 Settings 里存好的，保证 Bot 推送的和网页显示的一致
        $savedJson = Settings::get('current_prediction');
        if ($savedJson) {
            $prediction = json_decode($savedJson, true);
        } else {
            // 如果没有存档，现场算一个
            $fullStmt = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 100");
            $fullHistory = $fullStmt->fetchAll();
            $prediction = LotteryLogic::predict($fullHistory);
            // 存回去
            Settings::set('current_prediction', json_encode($prediction));
        }

        $nextIssue = isset($history[0]) ? $history[0]['issue'] + 1 : '???';

        echo json_encode([
            'status' => 'success',
            'data' => [
                'history' => $processedHistory,
                'prediction' => $prediction,
                'next_issue' => $nextIssue
            ]
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
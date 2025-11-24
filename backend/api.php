<?php
require_once 'utils/Env.php';
require_once 'utils/Db.php';
require_once 'utils/LotteryLogic.php';

Env::load(__DIR__ . '/.env');

// 跨域设置
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed_origin = $_ENV['FRONTEND_URL'];

// 允许前端域名访问
header("Access-Control-Allow-Origin: " . $allowed_origin);
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$action = $_GET['action'] ?? '';

try {
    $pdo = Db::connect();

    if ($action === 'get_data') {
        // 1. 获取最近 50 期历史记录
        $stmt = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 50");
        $history = $stmt->fetchAll();

        // 2. 处理历史记录，附加生肖和波色信息
        $processedHistory = [];
        foreach ($history as $row) {
            $nums = [];
            // 处理平码
            for($i=1; $i<=6; $i++) {
                $nums[] = LotteryLogic::getInfo($row["n$i"]);
            }
            // 处理特码
            $specInfo = LotteryLogic::getInfo($row['spec']);
            
            $processedHistory[] = [
                'id' => $row['id'],
                'issue' => $row['issue'],
                'normals' => $nums,
                'spec' => $specInfo
            ];
        }

        // 3. 进行下期预测 (基于最近 100 期数据，如果不足则用全部)
        $stmtPredict = $pdo->query("SELECT spec FROM lottery_records ORDER BY issue DESC LIMIT 100");
        $predictBase = $stmtPredict->fetchAll();
        $prediction = LotteryLogic::predict($predictBase);

        echo json_encode([
            'status' => 'success',
            'data' => [
                'history' => $processedHistory,
                'prediction' => $prediction,
                'next_issue' => isset($history[0]) ? $history[0]['issue'] + 1 : 'wait'
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
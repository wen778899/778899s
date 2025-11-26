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
header("Content-Type: application/json");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$action = $_GET['action'] ?? '';

try {
    $pdo = Db::connect();

    if ($action === 'get_data') {
        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
        $stmt = $pdo->prepare("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT ?");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $history = $stmt->fetchAll();

        $processedHistory = [];
        foreach ($history as $row) {
            $nums = [];
            for($i=1; $i<=6; $i++) $nums[] = ZodiacManager::getInfo($row["n$i"]);
            $specInfo = ZodiacManager::getInfo($row['spec']);
            $processedHistory[] = ['id' => $row['id'], 'issue' => $row['issue'], 'normals' => $nums, 'spec' => $specInfo, 'created_at' => $row['created_at']];
        }

        $publicJson = Settings::get('public_prediction');
        $prediction = $publicJson ? json_decode($publicJson, true) : null;
        $nextIssue = isset($history[0]) ? $history[0]['issue'] + 1 : '???';
        $countStmt = $pdo->query("SELECT COUNT(*) FROM lottery_records");

        echo json_encode(['status' => 'success', 'data' => ['history' => $processedHistory, 'prediction' => $prediction, 'next_issue' => $nextIssue, 'total_count' => $countStmt->fetchColumn()]]);
    } 
    elseif ($action === 'get_history') {
        $stmt = $pdo->query("SELECT * FROM prediction_history WHERE result_zodiac IS NOT NULL ORDER BY issue DESC LIMIT 20");
        echo json_encode(['status'=>'success', 'data'=>$stmt->fetchAll()]);
    }
} catch (Exception $e) { http_response_code(500); echo json_encode(['status'=>'error']); }
?>
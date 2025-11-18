<?php
// 文件路径: backend/api/points/transfer.php
require_once __DIR__ . '/../../utils/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

$from_user_id = require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('仅支持POST方法', 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$recipient_public_id = $data['recipient_id'] ?? '';
$amount = $data['amount'] ?? 0;

if (empty($recipient_public_id) || !is_numeric($amount) || $amount <= 0) {
    json_error('无效的接收者ID或金额');
}
$amount = (int)$amount;

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();

    // 1. 检查接收者是否存在并获取其ID
    $stmt = $pdo->prepare("SELECT id FROM users WHERE public_id = ?");
    $stmt->execute([$recipient_public_id]);
    $recipient = $stmt->fetch();
    if (!$recipient) {
        $pdo->rollBack();
        json_error('接收用户不存在');
    }
    $to_user_id = $recipient['id'];

    if($from_user_id == $to_user_id) {
        $pdo->rollBack();
        json_error('不能给自己赠送积分');
    }

    // 2. 锁定并检查赠送者积分是否足够
    $stmt = $pdo->prepare("SELECT points FROM users WHERE id = ? FOR UPDATE");
    $stmt->execute([$from_user_id]);
    $sender = $stmt->fetch();

    if (!$sender || $sender['points'] < $amount) {
        $pdo->rollBack();
        json_error('您的积分不足');
    }

    // 3. 执行转账
    $stmt = $pdo->prepare("UPDATE users SET points = points - ? WHERE id = ?");
    $stmt->execute([$amount, $from_user_id]);

    $stmt = $pdo->prepare("UPDATE users SET points = points + ? WHERE id = ?");
    $stmt->execute([$amount, $to_user_id]);
    
    // 4. 记录日志
    $stmt = $pdo->prepare("INSERT INTO points_transfer_log (from_user_id, to_user_id, amount) VALUES (?, ?, ?)");
    $stmt->execute([$from_user_id, $to_user_id, $amount]);

    $pdo->commit();
    
    // 返回赠送者的新积分
    $new_points = $sender['points'] - $amount;
    json_response(['message' => '赠送成功', 'new_points' => $new_points]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('服务器内部错误: ' . $e->getMessage(), 500);
}
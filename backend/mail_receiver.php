<?php
// backend/mail_receiver.php
require_once __DIR__ . '/config.php';

// 简单验证 Worker 的 Secret
$headers = getallheaders();
$auth = $headers['Authorization'] ?? '';
$env = parse_ini_file(__DIR__ . '/.env');

// 注意：IP-DDNS 环境下 Authorization 头可能被丢弃，建议也支持 URL 参数
$secret = $_GET['secret'] ?? str_replace('Bearer ', '', $auth);

if ($secret !== ($env['EMAIL_WORKER_SECRET'] ?? 'default_secret')) {
    http_response_code(403);
    exit('Forbidden');
}

$input = json_decode(file_get_contents('php://input'), true);
$sender = $input['sender'] ?? '';
$content = $input['raw_content'] ?? '';

if (!$sender || !$content) exit('Invalid Data');

$pdo = get_db_connection();
$stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
$stmt->execute([$sender]);
$user_id = $stmt->fetchColumn();

if ($user_id) {
    // 存入数据库
    $stmt = $pdo->prepare("INSERT INTO raw_emails (user_id, content) VALUES (?, ?)");
    $stmt->execute([$user_id, $content]);
    
    // 自动清理旧邮件 (保留最近10条)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM raw_emails WHERE user_id = ?");
    $stmt->execute([$user_id]);
    if ($stmt->fetchColumn() > 10) {
        $pdo->prepare("DELETE FROM raw_emails WHERE user_id = ? ORDER BY id ASC LIMIT 1")->execute([$user_id]);
    }
    echo "Saved";
} else {
    echo "User not found";
}
?>
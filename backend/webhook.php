<?php
require_once 'utils/Env.php';
require_once 'utils/Db.php';
Env::load(__DIR__ . '/.env');

// --- 辅助函数：发送回复 (修复版) ---
function replyToTelegram($chatId, $message) {
    // 强制清理 Token，防止换行符导致 URL 报错
    $token = trim($_ENV['TG_BOT_TOKEN']);
    $url = "https://api.telegram.org/bot$token/sendMessage";
    
    $data = [
        'chat_id' => $chatId,
        'text' => $message
    ];
    
    // 使用 CURL 发送，更稳定
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $result = curl_exec($ch);
    curl_close($ch);
}

// ==========================================
// 1. 基础验证
// ==========================================

$secretHeader = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
if ($secretHeader !== trim($_ENV['TG_SECRET_TOKEN'])) {
    http_response_code(403);
    die('Forbidden');
}

$content = file_get_contents("php://input");
$update = json_decode($content, true);

if (!isset($update['message']['text'])) {
    echo 'ok'; exit;
}

$chatId = $update['message']['chat']['id'];
$text = $update['message']['text'];
$senderId = $update['message']['from']['id'] ?? 0;
$adminId = trim($_ENV['TG_ADMIN_ID']); // 获取 .env 里的 ID

// ==========================================
// 2. 逻辑处理
// ==========================================

// A. 如果用户发 /start
if ($text === '/start') {
    if ((string)$senderId === (string)$adminId) {
        replyToTelegram($chatId, "✅ 管理员 (ID: $senderId) 验证通过！\n\n请直接发送开奖内容，例如：\n新澳门六合彩第:2025327期...\n13 44 09 21 31 22 37");
    } else {
        replyToTelegram($chatId, "❌ 未授权用户 (ID: $senderId)。");
    }
    echo 'ok'; exit;
}

// B. 验证权限
if ((string)$senderId !== (string)$adminId) {
    echo 'ok'; exit;
}

// C. 正则匹配数据
// 匹配 "第:2025327期" 或 "第2025327期"
preg_match('/第[:]?(\d+)期/', $text, $issueMatch);
// 匹配所有两位数字
preg_match_all('/\b\d{2}\b/', $text, $numMatches);

if (!empty($issueMatch) && count($numMatches[0]) >= 7) {
    $issue = $issueMatch[1];
    $nums = $numMatches[0];
    
    // 取前7个数字
    $saveNums = array_slice($nums, 0, 7);
    
    try {
        $pdo = Db::connect();
        $sql = "INSERT IGNORE INTO lottery_records (issue, n1, n2, n3, n4, n5, n6, spec) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$issue, $saveNums[0], $saveNums[1], $saveNums[2], $saveNums[3], $saveNums[4], $saveNums[5], $saveNums[6]]);
        
        if ($stmt->rowCount() > 0) {
            replyToTelegram($chatId, "✅ 第 {$issue} 期 录入成功！\n特码：{$saveNums[6]}");
        } else {
            replyToTelegram($chatId, "⚠️ 第 {$issue} 期 已存在，跳过。");
        }
        
    } catch (Exception $e) {
        replyToTelegram($chatId, "❌ 数据库错误：" . $e->getMessage());
    }
} else {
    // 只有当看起来像是在录数据但格式不对时才提示，避免闲聊被打扰
    if (strpos($text, '期') !== false) {
        replyToTelegram($chatId, "❓ 格式错误：未找到期号或数字不足7个。");
    }
}

echo 'ok';
?>
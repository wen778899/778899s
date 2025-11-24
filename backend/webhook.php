<?php
// 引入依赖
require_once 'utils/Env.php';
require_once 'utils/Db.php';
Env::load(__DIR__ . '/.env');

// 1. 安全验证
$secret = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
if ($secret !== $_ENV['TG_SECRET_TOKEN']) {
    http_response_code(403);
    die('Forbidden');
}

// 2. 获取消息
$content = file_get_contents("php://input");
$update = json_decode($content, true);

if (!isset($update['message']['text'])) die('ok');

$text = $update['message']['text'];
// 示例文本: 新澳门六合彩第:2025327期... \n 13 44 09 21 31 22 37
// 正则提取期号
preg_match('/第:(\d+)期/', $text, $issueMatch);
// 正则提取所有两位的数字
preg_match_all('/\b\d{2}\b/', $text, $numMatches);

if (!empty($issueMatch) && count($numMatches[0]) >= 7) {
    $issue = $issueMatch[1];
    $nums = $numMatches[0]; // 这是一个数组，包含前7个匹配到的数字

    // 第7个数字作为特码，前6个平码
    // 注意：需要确保提取的是开奖号码，而不是下方的文字里的数字（如果有的话）
    // 假设开奖号码紧跟在期号行之后
    
    $n1 = $nums[0]; $n2 = $nums[1]; $n3 = $nums[2];
    $n4 = $nums[3]; $n5 = $nums[4]; $n6 = $nums[5];
    $spec = $nums[6];

    try {
        $pdo = Db::connect();
        $stmt = $pdo->prepare("INSERT IGNORE INTO lottery_records (issue, n1, n2, n3, n4, n5, n6, spec) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$issue, $n1, $n2, $n3, $n4, $n5, $n6, $spec]);
    } catch (Exception $e) {
        // 记录日志
        file_put_contents('error.log', $e->getMessage(), FILE_APPEND);
    }
}

echo 'ok';
?>
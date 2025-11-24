<?php
// 允许命令行执行，或者通过 webhook 传参 manual 执行
if (isset($_SERVER['REMOTE_ADDR']) && !in_array($argv[1]??'', ['manual'])) {
    die('Forbidden');
}

require_once __DIR__ . '/utils/Env.php';
require_once __DIR__ . '/utils/Db.php';
require_once __DIR__ . '/utils/LotteryLogic.php';
require_once __DIR__ . '/utils/Settings.php';

Env::load(__DIR__ . '/.env');

// 1. 检查开关
$isManual = ($argv[1] ?? '') === 'manual';
$isEnabled = Settings::get('push_enabled', '0') === '1';

if (!$isEnabled && !$isManual) {
    echo "Push is disabled in settings.\n";
    exit;
}

function broadcastToChannel($text) {
    $token = trim($_ENV['TG_BOT_TOKEN']);
    $channelId = trim($_ENV['TG_CHANNEL_ID']);
    $url = "https://api.telegram.org/bot$token/sendMessage";
    $data = ['chat_id' => $channelId, 'text' => $text, 'parse_mode' => 'Markdown'];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_exec($ch);
    curl_close($ch);
}

try {
    $pdo = Db::connect();
    
    // 获取最新一期期号，为了显示在文案里
    $stmt = $pdo->query("SELECT issue FROM lottery_records ORDER BY issue DESC LIMIT 1");
    $lastRow = $stmt->fetch();
    
    if (!$lastRow) exit;

    $nextIssue = $lastRow['issue'] + 1;

    // ========================================================
    // 核心修正：优先从数据库读取已锁定的预测，而不是重新计算
    // ========================================================
    
    $savedJson = Settings::get('current_prediction');
    $pred = null;

    if ($savedJson) {
        // 1. 尝试读取已保存的预测 (保证和前端一致)
        $pred = json_decode($savedJson, true);
        echo "Loaded prediction from Database (Synced).\n";
    }

    if (!$pred) {
        // 2. 兜底逻辑：如果数据库里竟然没有（比如刚清空过），才被迫重算
        // 这种情况极少发生，一旦发生，立即存入数据库，保证后续一致
        echo "No saved prediction found. Calculating new one...\n";
        $stmtHist = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 100");
        $history = $stmtHist->fetchAll();
        $pred = LotteryLogic::predict($history);
        Settings::set('current_prediction', json_encode($pred));
    }

    // ========================================================

    // 构建文案
    $sxEmoji = ['鼠'=>'🐀','牛'=>'🐂','虎'=>'🐅','兔'=>'🐇','龙'=>'🐉','蛇'=>'🐍','马'=>'🐎','羊'=>'🐏','猴'=>'🐒','鸡'=>'🐓','狗'=>'🐕','猪'=>'🐖'];
    $sixXiaoStr = "";
    foreach ($pred['six_xiao'] as $sx) {
        $sixXiaoStr .= ($sxEmoji[$sx]??'') . "*{$sx}*  ";
    }
    
    $colorMap = ['red'=>'🔴 红波', 'blue'=>'🔵 蓝波', 'green'=>'🟢 绿波'];
    $waveStr = $colorMap[$pred['color_wave']] ?? '未知';

    $message = "🔮 *第 {$nextIssue} 期 智能算法预测* 🔮\n\n";
    $message .= "🦁 *六肖推荐*：\n{$sixXiaoStr}\n\n";
    $message .= "🌊 *主攻波色*：\n{$waveStr}\n\n";
    $message .= "-------------------------------\n";
    $message .= "⚠️ _数据仅供技术统计，理性参考_";

    broadcastToChannel($message);
    echo "Pushed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
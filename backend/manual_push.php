<?php
// 此文件由 Webhook 引用执行，或命令行执行
if (!defined('ABSPATH') && !isset($argc) && !isset($update)) {
    // 简单的防直接访问保护
    // 实际使用中由 webhook include 即可
}

require_once 'utils/Env.php';
require_once 'utils/Db.php';
require_once 'utils/Settings.php';

Env::load(__DIR__ . '/.env');

function broadcastMsg($text) {
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
    
    // 1. 获取最新期号
    $stmt = $pdo->query("SELECT issue FROM lottery_records ORDER BY issue DESC LIMIT 1");
    $row = $stmt->fetch();
    if (!$row) return; 
    $nextIssue = $row['issue'] + 1;

    // 2. 读取已生成的预测 (确保唯一性)
    $json = Settings::get('current_prediction');
    if (!$json) return; // 没预测就不发
    
    $pred = json_decode($json, true);

    // 3. 构建文案
    $sxEmoji = ['鼠'=>'🐀','牛'=>'🐂','虎'=>'🐅','兔'=>'🐇','龙'=>'🐉','蛇'=>'🐍','马'=>'🐎','羊'=>'🐏','猴'=>'🐒','鸡'=>'🐓','狗'=>'🐕','猪'=>'🐖'];
    $sixXiaoStr = "";
    foreach ($pred['six_xiao'] as $sx) {
        $sixXiaoStr .= ($sxEmoji[$sx]??'') . "*{$sx}*  ";
    }
    
    $colorMap = ['red'=>'🔴 红波', 'blue'=>'🔵 蓝波', 'green'=>'🟢 绿波'];
    $waveStr = $colorMap[$pred['color_wave']] ?? '';

    $msg = "🔮 *第 {$nextIssue} 期 智能算法预测* 🔮\n\n";
    $msg .= "🦁 *六肖推荐*：\n{$sixXiaoStr}\n\n";
    $msg .= "🌊 *主攻波色*：\n{$waveStr}\n\n";
    $msg .= "-------------------------------\n";
    $msg .= "⚠️ _数据仅供技术统计，理性参考_";

    broadcastMsg($msg);

} catch (Exception $e) {
    // 静默失败
}
?>
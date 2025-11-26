<?php
if (!defined('ABSPATH') && !isset($argc) && !isset($update)) {}
require_once 'utils/Env.php'; require_once 'utils/Db.php'; require_once 'utils/Settings.php';
Env::load(__DIR__ . '/.env');

function broadcastMsg($text) {
    $token = trim($_ENV['TG_BOT_TOKEN']); $channelId = trim($_ENV['TG_CHANNEL_ID']);
    $url = "https://api.telegram.org/bot$token/sendMessage";
    $data = ['chat_id' => $channelId, 'text' => $text, 'parse_mode' => 'Markdown'];
    $ch = curl_init(); curl_setopt($ch, CURLOPT_URL, $url); curl_setopt($ch, CURLOPT_POST, 1); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data)); curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); curl_exec($ch); curl_close($ch);
}

try {
    $pdo = Db::connect();
    $stmt = $pdo->query("SELECT issue FROM lottery_records ORDER BY issue DESC LIMIT 1");
    $row = $stmt->fetch(); if (!$row) return; 
    $nextIssue = $row['issue'] + 1;

    $json = Settings::get('current_prediction'); if (!$json) return;
    $pred = json_decode($json, true);

    $sxEmoji = ['鼠'=>'🐀','牛'=>'🐂','虎'=>'🐅','兔'=>'🐇','龙'=>'🐉','蛇'=>'🐍','马'=>'🐎','羊'=>'🐏','猴'=>'🐒','鸡'=>'🐓','狗'=>'🐕','猪'=>'🐖'];
    $cMap = ['red'=>'🔴红','blue'=>'🔵蓝','green'=>'🟢绿'];

    $sixStr = ""; foreach ($pred['six_xiao'] as $sx) $sixStr .= ($sxEmoji[$sx]??'') . "*$sx* ";
    $threeXiao = $pred['three_xiao'] ?? array_slice($pred['six_xiao'], 0, 3);
    $threeStr = ""; foreach ($threeXiao as $sx) $threeStr .= ($sxEmoji[$sx]??'') . "*$sx* ";

    $w1 = $pred['color_wave']['primary']; $w2 = $pred['color_wave']['secondary'];
    $w1Text = $cMap[$w1] ?? ''; $w2Text = $cMap[$w2] ?? '';
    $bs = $pred['bs'] ?? '-'; $oe = $pred['oe'] ?? '-';

    $killedStr = ''; if (preg_match('/杀[:：](.+)/u', $pred['strategy_used'], $m)) $killedStr = $m[1];

    $msg = "🔮 *第 {$nextIssue} 期 智能大数据预测* 🔮\n\n";
    if ($killedStr) $msg .= "🚫 *本期绝杀*：{$killedStr}\n-------------------------------\n";
    $msg .= "🦁 *推荐六肖*：\n{$sixStr}\n\n";
    $msg .= "🔥 *精选三肖*：\n{$threeStr}\n\n";
    $msg .= "🌊 *波色*：{$w1Text} / {$w2Text}\n";
    $msg .= "👊 *主攻*：{$w1Text}\n";
    $msg .= "⚖️ *属性*：{$bs} / {$oe}\n";
    $msg .= "-------------------------------\n";
    $msg .= "⚠️ _数据基于历史概率统计，仅供参考_";

    broadcastMsg($msg);
} catch (Exception $e) {}
?>
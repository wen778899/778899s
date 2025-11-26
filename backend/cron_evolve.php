<?php
ignore_user_abort(true);
set_time_limit(60);

require_once 'utils/Env.php';
require_once 'utils/Db.php';
require_once 'utils/LotteryLogic.php';
require_once 'utils/Settings.php';
require_once 'utils/ZodiacManager.php';

Env::load(__DIR__ . '/.env');

if (Settings::get('is_evolving') !== '1') exit;

function editMsgFromCron($chatId, $msgId, $text) {
    $token = trim($_ENV['TG_BOT_TOKEN']);
    $url = "https://api.telegram.org/bot$token/editMessageText";
    $keyboard = ['inline_keyboard' => [[['text' => '🔄 立即刷新', 'callback_data' => 'refresh_progress']]]];
    $data = ['chat_id' => $chatId, 'message_id' => $msgId, 'text' => $text, 'parse_mode' => 'Markdown', 'reply_markup' => json_encode($keyboard)];
    $ch = curl_init(); curl_setopt($ch, CURLOPT_URL, $url); curl_setopt($ch, CURLOPT_POST, 1); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data)); curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); curl_exec($ch); curl_close($ch);
}

// --- 保持与 Webhook 一致的丰富展示 ---
function getProgressMsg($gen, $pred, $isEvolving) {
    $statusIcon = ($isEvolving == '1') ? "⚡ 进化中" : "💤 已停止";
    $score = 0; if (isset($pred['strategy_used']) && preg_match('/分:([\d\.]+)/', $pred['strategy_used'], $m)) $score = $m[1];
    
    $pdo = Db::connect();
    $stmt = $pdo->query("SELECT issue FROM lottery_records ORDER BY issue DESC LIMIT 1");
    $nextIssue = ($stmt->fetch()['issue'] ?? 0) + 1;
    
    $cMap = ['red'=>'红','blue'=>'蓝','green'=>'绿'];
    $sixStr = implode(" ", $pred['six_xiao']); 
    $threeStr = implode(" ", $pred['three_xiao']); 
    $w1 = $cMap[$pred['color_wave']['primary']] ?? '';
    $w2 = $cMap[$pred['color_wave']['secondary']] ?? '';
    $bs = $pred['bs'] ?? '-';
    $oe = $pred['oe'] ?? '-';
    $killed = $pred['killed'] ?? '-';
    
    $timeStr = date("H:i:s");
    $load = ['🟩⬜⬜⬜⬜', '🟩🟩⬜⬜⬜', '🟩🟩🟩⬜⬜', '🟩🟩🟩🟩⬜', '🟩🟩🟩🟩🟩']; $bar = $load[time() % 5];

    $msg = "🧬 *AI 进化监控台*\n";
    $msg .= "------------------\n";
    $msg .= "💓 引擎全速运行\n";
    $msg .= "{$statusIcon} | 进化 `{$gen}` 代\n";
    $msg .= "{$bar}\n";
    $msg .= "------------------\n";
    $msg .= "🎯 目标：*{$nextIssue}*\n";
    $msg .= "🧠 适应度：`{$score}`\n";
    $msg .= "🚫 *暂杀*: {$killed}\n";
    $msg .= "🦁 *暂六*: {$sixStr}\n";
    $msg .= "🔥 *暂三*: {$threeStr}\n";
    $msg .= "🌊 *波色*: {$w1} / {$w2}\n";
    $msg .= "👊 *主攻*: {$w1}\n";
    $msg .= "⚖️ *属性*: {$bs} / {$oe}\n";
    $msg .= "------------------\n";
    $msg .= "🕒 {$timeStr}";
    return $msg;
}

try {
    $pdo = Db::connect();
    $stmt = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 100");
    $history = $stmt->fetchAll();
    if (!$history) exit;

    $popJson = Settings::get('evolution_population');
    $gen = intval(Settings::get('evolution_gen'));
    
    if ($popJson) {
        $population = json_decode($popJson, true);
    } else {
        $population = [];
        for($i=0; $i<15; $i++) $population[] = ['w_trend'=>rand(0,100)/10, 'w_omiss'=>rand(0,100)/10, 'w_link'=>rand(0,100)/10, 'w_tail'=>rand(0,100)/10, 'w_head'=>rand(0,100)/10, 'w_color'=>rand(0,100)/10, 'w_wuxing'=>rand(0,100)/10, 'w_hist'=>rand(0,100)/10, 'w_flat'=>rand(0,100)/10, 'w_off'=>rand(0,100)/10, 'fitness'=>0];
    }

    $start = time();
    while(time() - $start < 50) {
        if (Settings::get('is_evolving') !== '1') break;
        // 每次跑50代，减少IO
        for($k=0; $k<50; $k++) {
            $res = LotteryLogic::evolveStep($history, $population);
            $population = $res['population']; $bestGene = $res['best']; $gen++;
        }
    }

    Settings::set('evolution_population', json_encode($population));
    Settings::set('evolution_gen', $gen);
    $pred = LotteryLogic::generateResult($history, $bestGene, $gen);
    Settings::set('staging_prediction', json_encode($pred));
    Settings::set('last_cron_run', time());

    if ($gen % 10 == 0) {
        $chatId = Settings::get('progress_chat_id');
        $msgId = Settings::get('progress_msg_id');
        if ($chatId && $msgId) editMsgFromCron($chatId, $msgId, getProgressMsg($gen, $pred, '1'));
    }

} catch (Exception $e) { echo $e->getMessage(); }
?>
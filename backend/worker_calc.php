<?php
// backend/worker_calc.php
// 这个脚本由 webhook 触发，在后台运行

ignore_user_abort(true); // 即使客户端断开，脚本继续运行
set_time_limit(300);     // 允许运行 5 分钟

require_once 'utils/Env.php';
require_once 'utils/Db.php';
require_once 'utils/LotteryLogic.php';
require_once 'utils/Settings.php';
require_once 'utils/ZodiacManager.php';

Env::load(__DIR__ . '/.env');

function sendMsg($chatId, $text) {
    $token = trim($_ENV['TG_BOT_TOKEN']);
    if (!$token) return;
    $url = "https://api.telegram.org/bot$token/sendMessage";
    $data = ['chat_id' => $chatId, 'text' => $text, 'parse_mode' => 'Markdown'];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_exec($ch);
    curl_close($ch);
}

// 1. 标记状态：正在计算
Settings::set('is_calculating', '1');

try {
    $pdo = Db::connect();
    $stmt = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 100");
    $history = $stmt->fetchAll();

    if ($history) {
        // 2. 执行耗时的遗传算法
        $pred = LotteryLogic::predict($history);
        
        // 3. 保存结果
        Settings::set('current_prediction', json_encode($pred));
        
        // 4. 存入历史表
        $nextIssue = $history[0]['issue'] + 1;
        $sql = "INSERT IGNORE INTO prediction_history 
                (issue, six_xiao, three_xiao, wave_primary, wave_secondary, strategy_used) 
                VALUES (?, ?, ?, ?, ?, ?)";
        $stmtPred = $pdo->prepare($sql);
        $stmtPred->execute([
            $nextIssue, 
            implode(',', $pred['six_xiao']), 
            implode(',', $pred['three_xiao']), 
            $pred['color_wave']['primary'], 
            $pred['color_wave']['secondary'], 
            $pred['strategy_used']
        ]);

        // 5. (可选) 通知管理员计算完成
        $adminId = trim($_ENV['TG_ADMIN_ID']);
        if ($adminId) {
            sendMsg($adminId, "✅ *AI 计算完成*\n第 {$nextIssue} 期预测已更新。");
        }
    }
} catch (Exception $e) {
    // 记录错误
    file_put_contents(__DIR__ . '/error_worker.log', $e->getMessage());
}

// 6. 标记状态：计算结束
Settings::set('is_calculating', '0');
?>

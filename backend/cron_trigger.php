<?php
// 文件路径: backend/cron_trigger.php

// 简单的安全措施，防止被随意调用
// 请在外部Cron服务的URL中添加这个secret参数
$secret = $_GET['secret'] ?? '';
if ($secret !== 'YOUR_VERY_SECRET_KEY_HERE') {
    http_response_code(403);
    die('Forbidden');
}

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/lib/TelegramBot.php';
require_once __DIR__ . '/lib/GameLogic.php';

try {
    $pdo = getDBConnection();
    $gameLogic = new GameLogic($pdo);

    $min_threshold = 320;
    $target_level = 960;

    $current_stock = $gameLogic->getUnusedHandsCount();

    if ($current_stock < $min_threshold) {
        $needed = $target_level - $current_stock;
        $generated_count = $gameLogic->generateNewHands($needed);
        
        // 发送通知
        $bot_token = getEnvVariable('TELEGRAM_BOT_TOKEN');
        $admin_chat_id = getEnvVariable('ADMIN_CHAT_ID');

        if ($bot_token && $admin_chat_id) {
            $bot = new TelegramBot($bot_token);
            $message = "【自动补货通知】\n";
            $message .= "牌局库存低于 {$min_threshold} 局，已自动补充。\n";
            $message .= "*当前库存*: {$current_stock}\n";
            $message .= "*本次新增*: {$generated_count}\n";
            $message .= "*最新库存*: " . ($current_stock + $generated_count);
            $bot->sendMessage($admin_chat_id, $message);
        }
        echo "Stock refilled. Generated {$generated_count} new hands.";
    } else {
        echo "Stock is sufficient: {$current_stock}.";
    }

} catch (Exception $e) {
    error_log("Cron Trigger Error: " . $e->getMessage());
    http_response_code(500);
    echo "An error occurred.";
}
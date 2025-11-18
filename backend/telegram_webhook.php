<?php
// 文件路径: backend/telegram_webhook.php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/lib/TelegramBot.php';
require_once __DIR__ . '/lib/GameLogic.php';

$bot_token = getEnvVariable('TELEGRAM_BOT_TOKEN');
$admin_chat_id = getEnvVariable('ADMIN_CHAT_ID');
$bot = new TelegramBot($bot_token);

$update = json_decode(file_get_contents('php://input'), true);

if (!$update) {
    exit();
}

$message = $update['message'] ?? null;
$chat_id = $message['chat']['id'] ?? null;
$text = $message['text'] ?? '';

// 安全校验：只处理来自管理员的消息
if ($chat_id != $admin_chat_id) {
    exit();
}

try {
    $pdo = getDBConnection();
    $gameLogic = new GameLogic($pdo);
    
    $parts = explode(' ', $text);
    $command = $parts[0];
    $params = array_slice($parts, 1);
    
    $reply = '';

    switch ($command) {
        case '/start':
            $reply = "欢迎使用十三水管理后台！";
            break;
            
        case '/check_stock':
            $count = $gameLogic->getUnusedHandsCount();
            $reply = "当前牌局库存剩余: *{$count}* 局。";
            break;
            
        case '/fill_stock':
            $target_level = 960;
            $current_stock = $gameLogic->getUnusedHandsCount();
            if($current_stock >= $target_level){
                $reply = "库存已满({$current_stock}局)，无需补充。";
            } else {
                $needed = $target_level - $current_stock;
                $generated = $gameLogic->generateNewHands($needed);
                $reply = "库存已从 {$current_stock} 补满至 " . ($current_stock + $generated) . "。\n本次新增 *{$generated}* 局。";
            }
            break;

        case '/generate_hands':
            $count = (int)($params[0] ?? 0);
            if ($count > 0 && $count <= 2000) { // 加个上限防止误操作
                $generated = $gameLogic->generateNewHands($count);
                $new_total = $gameLogic->getUnusedHandsCount();
                $reply = "成功生成 *{$generated}* 局牌。\n当前总库存: *{$new_total}* 局。";
            } else {
                $reply = "请输入要生成的数量 (1-2000)。\n用法: `/generate_hands 100`";
            }
            break;
        
        // 更多管理命令... 例如 /delete_user, /add_points 等可以后续添加
        
        default:
            $reply = "未知指令。\n可用指令:\n`/check_stock` - 查看库存\n`/fill_stock` - 补满库存至960\n`/generate_hands [数量]` - 生成指定数量牌局";
    }
    
    $bot->sendMessage($chat_id, $reply);

} catch (Exception $e) {
    error_log("Webhook Error: " . $e->getMessage());
    // 可以在出错时也通知管理员
    $bot->sendMessage($admin_chat_id, "机器人后台出错: " . $e->getMessage());
}
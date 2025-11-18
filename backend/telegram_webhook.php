<?php
// 文件路径: backend/telegram_webhook.php (最终稳定版)

// -------------------------------------------------------------------
//  配置与日志
// -------------------------------------------------------------------
define('DEBUG', true);
define('LOG_FILE', __DIR__ . '/webhook_debug.log');

function write_log($message) {
    if (DEBUG) {
        $log_entry = "[" . date('Y-m-d H:i:s') . "] " . $message . "\n";
        file_put_contents(LOG_FILE, $log_entry, FILE_APPEND);
    }
}

// -------------------------------------------------------------------
//  主执行体
// -------------------------------------------------------------------
try {
    // 捕获最原始的请求
    $raw_input = file_get_contents('php://input');
    write_log("--- RAW REQUEST BODY: " . $raw_input . " ---");

    // 引入依赖文件
    require_once __DIR__ . '/config/database.php';
    require_once __DIR__ . '/lib/TelegramBot.php';
    require_once __DIR__ . '/lib/GameLogic.php';
    require_once __DIR__ . '/lib/AdminLogic.php';

    // 获取配置
    $bot_token = getEnvVariable('TELEGRAM_BOT_TOKEN');
    $admin_chat_id = (int)getEnvVariable('ADMIN_CHAT_ID');

    // 解析数据
    $update = json_decode($raw_input, true);
    $message = $update['message'] ?? null;
    $chat_id = (int)($message['chat']['id'] ?? 0);
    $text = trim($message['text'] ?? '');

    // 安全校验
    if ($chat_id !== $admin_chat_id) {
        write_log("Security check failed. Received Chat ID: {$chat_id}, Expected: {$admin_chat_id}.");
        exit();
    }

    // 初始化服务
    $bot = new TelegramBot($bot_token);
    $pdo = getDBConnection();
    $gameLogic = new GameLogic($pdo);
    $adminLogic = new AdminLogic($pdo);

    // -------------------------------------------------------------------
    //  键盘与命令定义 (集中管理)
    // -------------------------------------------------------------------
    define('BTN_HANDS_MENU', '🃏 牌局管理');
    define('BTN_USERS_MENU', '👥 用户管理');
    define('BTN_BACK_TO_MAIN', '« 返回主菜单');
    define('BTN_CHECK_STOCK', '📊 检查库存');
    define('BTN_FILL_STOCK', '📦 补满库存');
    define('BTN_FIND_USER_PROMPT', '🔎 查询用户');
    define('BTN_UPDATE_POINTS_PROMPT', '💰 增减积分');
    define('BTN_DELETE_USER_PROMPT', '❌ 删除用户');

    $main_keyboard = [[BTN_HANDS_MENU, BTN_USERS_MENU]];
    $hands_keyboard = [[BTN_CHECK_STOCK, BTN_FILL_STOCK], [BTN_BACK_TO_MAIN]];
    $users_keyboard = [[BTN_FIND_USER_PROMPT, BTN_UPDATE_POINTS_PROMPT], [BTN_DELETE_USER_PROMPT], [BTN_BACK_TO_MAIN]];

    // -------------------------------------------------------------------
    //  命令处理核心逻辑 (重构)
    // -------------------------------------------------------------------
    
    // 将文本分割成命令和参数数组
    $parts = explode(' ', $text, 2);
    $command = $parts[0] ?? '';
    $params_str = $parts[1] ?? '';

    write_log("Processed Command: '{$command}', Params String: '{$params_str}'");
    
    // 菜单导航 (直接比较整个文本)
    if ($text === '/start' || $text === '/menu' || $text === BTN_BACK_TO_MAIN) {
        $bot->sendMessageWithKeyboard($chat_id, "欢迎来到主菜单！", $main_keyboard);
        exit();
    }
    if ($text === BTN_HANDS_MENU) {
        $bot->sendMessageWithKeyboard($chat_id, "进入*牌局管理*菜单。", $hands_keyboard);
        exit();
    }
    if ($text === BTN_USERS_MENU) {
        $bot->sendMessageWithKeyboard($chat_id, "进入*用户管理*菜单。", $users_keyboard);
        exit();
    }
    
    // 功能指令 (按钮和命令分开处理)
    $final_reply = null;
    
    // 1. 处理按钮点击（提示信息）
    if ($text === BTN_CHECK_STOCK) {
        $count = $gameLogic->getUnusedHandsCount();
        $final_reply = "当前牌局库存剩余: *{$count}* 局。";
    } elseif ($text === BTN_FILL_STOCK) {
        $target_level = 960;
        $current_stock = $gameLogic->getUnusedHandsCount();
        if ($current_stock >= $target_level){
            $final_reply = "库存已满 ({$current_stock}局)，无需补充。";
        } else {
            $needed = $target_level - $current_stock;
            $generated = $gameLogic->generateNewHands($needed);
            $final_reply = "库存已从 {$current_stock} 补满至 " . ($current_stock + $generated) . "。\n本次新增 *{$generated}* 局。";
        }
    } elseif ($text === BTN_FIND_USER_PROMPT) {
        $final_reply = "请提供手机号或用户ID。\n用法: `/find_user [手机号或ID]`";
    } elseif ($text === BTN_UPDATE_POINTS_PROMPT) {
        $final_reply = "请提供指令以增减积分。\n用法: `/update_points [手机号或ID] [积分]`\n(负数表示减少积分)";
    } elseif ($text === BTN_DELETE_USER_PROMPT) {
        $final_reply = "请提供要删除的手机号或用户ID。\n用法: `/delete_user [手机号或ID]`";
    }
    // 2. 处理手动输入的命令
    elseif ($command === '/find_user') {
        if (empty($params_str)) {
            $final_reply = "请提供手机号或用户ID。";
        } else {
            $user = $adminLogic->findUser($params_str);
            if ($user) {
                $final_reply = "找到用户:\nID: `{$user['public_id']}`\n手机: `{$user['phone']}`\n积分: *{$user['points']}*\n注册时间: {$user['created_at']}";
            } else {
                $final_reply = "未找到用户: `{$params_str}`";
            }
        }
    } elseif ($command === '/update_points') {
        $params = explode(' ', $params_str);
        if (count($params) < 2 || !is_numeric($params[1])) {
            $final_reply = "格式错误。\n用法: `/update_points [手机号或ID] [积分数量]`";
        } else {
            $final_reply = $adminLogic->updateUserPoints($params[0], (int)$params[1]);
        }
    } elseif ($command === '/delete_user') {
        if (empty($params_str)) {
            $final_reply = "请提供要删除的手机号或用户ID。";
        } else {
            $final_reply = $adminLogic->deleteUser($params_str);
        }
    } elseif ($command === '/generate_hands') {
        $params = explode(' ', $params_str);
        $count = (int)($params[0] ?? 0);
        if ($count > 0 && $count <= 2000) {
            $generated = $gameLogic->generateNewHands($count);
            $new_total = $gameLogic->getUnusedHandsCount();
            $final_reply = "成功生成 *{$generated}* 局牌。\n当前总库存: *{$new_total}* 局。";
        } else {
            $final_reply = "用法: `/generate_hands 100`";
        }
    }
    
    // 如果没有任何匹配，则发送未知指令
    if ($final_reply === null && $command) {
        $final_reply = "未知指令: `{$text}`\n请使用键盘操作。";
    }

    // 发送最终回复
    if ($final_reply) {
        $bot->sendMessage($chat_id, $final_reply);
        write_log("Replied with: '{$final_reply}'");
    } else {
        write_log("No action taken for input: '{$text}'");
    }
    
} catch (Throwable $e) { // 使用 Throwable 捕获包括Fatal Error在内的所有错误
    write_log("!!! SCRIPT CRASHED !!!");
    write_log("Error Type: " . get_class($e));
    write_log("Error Message: " . $e->getMessage());
    write_log("File: " . $e->getFile());
    write_log("Line: " . $e->getLine());
    
    // 尝试通知管理员发生了错误
    if (isset($bot) && isset($admin_chat_id)) {
        // 使用一个非常简单的方式发送，避免再次触发错误
        @file_get_contents("https://api.telegram.org/bot{$bot_token}/sendMessage?chat_id={$admin_chat_id}&text=BOT_SCRIPT_CRASHED");
    }
}

write_log("--- Webhook execution finished ---");
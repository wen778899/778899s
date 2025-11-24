<?php
require_once 'utils/Env.php';
require_once 'utils/Db.php';
require_once 'utils/LotteryLogic.php';
require_once 'utils/Settings.php';
require_once 'utils/ZodiacManager.php';

Env::load(__DIR__ . '/.env');

// --- 辅助函数：发送消息 ---
function sendMsg($chatId, $text, $keyboard = null) {
    $token = trim($_ENV['TG_BOT_TOKEN']);
    $url = "https://api.telegram.org/bot$token/sendMessage";
    $data = ['chat_id' => $chatId, 'text' => $text, 'parse_mode' => 'Markdown'];
    if ($keyboard) $data['reply_markup'] = json_encode($keyboard);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_exec($ch);
    curl_close($ch);
}

// --- 辅助函数：强力文本清洗 ---
function cleanText($text) {
    $text = urldecode($text);
    $text = preg_replace('/\p{Z}+/u', ' ', $text); // 替换所有Unicode空格
    $text = preg_replace('/\p{C}+/u', ' ', $text); // 替换控制字符
    $text = preg_replace('/\s+/', ' ', $text);     // 合并空格
    return trim($text);
}

// --- 核心：刷新预测并保存 ---
// 每次数据变动时自动调用，读取100期数据进行深度推算
function refreshAndSave() {
    $pdo = Db::connect();
    $stmt = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 100");
    $history = $stmt->fetchAll();
    
    // 只要有数据就进行推算
    if ($history) {
        $pred = LotteryLogic::predict($history);
        Settings::set('current_prediction', json_encode($pred));
        return true;
    }
    return false;
}

// ==========================================
// 入口安全验证
// ==========================================
$secretHeader = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
if ($secretHeader !== trim($_ENV['TG_SECRET_TOKEN'])) {
    http_response_code(403); die('Forbidden');
}

$content = file_get_contents("php://input");
$update = json_decode($content, true);

$msgType = '';
if (isset($update['channel_post'])) $msgType = 'channel_post';
elseif (isset($update['message'])) $msgType = 'message';
else { echo 'ok'; exit; }

$data = $update[$msgType];
$rawText = $data['text'] ?? '';
$chatId = $data['chat']['id'];

// ==========================================
// 1. 频道开奖录入 (自动监听)
// ==========================================
$text = cleanText($rawText);
// 匹配期号
preg_match('/第[:：]?\s*(\d+)\s*期/u', $text, $issueMatch);

if (!empty($issueMatch)) {
    $issue = $issueMatch[1];
    // 移除期号，防止干扰号码提取
    $textWithoutIssue = str_replace($issue, '', $text);
    // 提取号码
    preg_match_all('/(?<!\d)(\d{2})(?!\d)/', $textWithoutIssue, $numMatches);
    
    $validNums = [];
    foreach ($numMatches[1] as $n) {
        $val = intval($n);
        if ($val >= 1 && $val <= 49) $validNums[] = $n;
    }

    if (count($validNums) >= 7) {
        $nums = array_slice($validNums, 0, 7);
        try {
            $pdo = Db::connect();
            $sql = "INSERT INTO lottery_records (issue, n1, n2, n3, n4, n5, n6, spec) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE n1=?, n2=?, n3=?, n4=?, n5=?, n6=?, spec=?";
            $stmt = $pdo->prepare($sql);
            $params = array_merge([$issue], $nums, $nums);
            $stmt->execute($params);
            
            // 录入成功后，自动触发高级推算
            refreshAndSave();
            
            // 私聊时给反馈
            if ($msgType === 'message') {
                sendMsg($chatId, "✅ *录入成功*\n第 `{$issue}` 期\n号码: " . implode(" ", $nums));
            }
        } catch (Exception $e) {}
        echo 'ok'; exit;
    }
}

// ==========================================
// 2. 管理员菜单 (仅私聊)
// ==========================================
if ($msgType === 'message') {
    $senderId = $data['from']['id'];
    $adminId = trim($_ENV['TG_ADMIN_ID']);

    if ((string)$senderId === (string)$adminId) {
        
        // --- 最终确定的简洁菜单 ---
        $mainKeyboard = [
            'keyboard' => [
                // 第一行：核心预测功能
                [['text' => '🔮 查看下期预测'], ['text' => '🚀 推送预测到频道']], 
                // 第二行：数据查看与配置
                [['text' => '📊 查看最新录入'], ['text' => '⚙️ 设置生肖数据']]
            ],
            'resize_keyboard' => true,
            'persistent_keyboard' => true
        ];

        // 1. 显示菜单
        if ($rawText === '/start') {
            sendMsg($chatId, "👋 欢迎使用智能分析系统\n隐形指令：发送 `删除2025xxx` 可修正数据。", $mainKeyboard);
        }

        // 2. 查看下期预测 (预览)
        elseif ($rawText === '🔮 查看下期预测') {
            $json = Settings::get('current_prediction');
            
            // 获取下期期号
            $pdo = Db::connect();
            $stmt = $pdo->query("SELECT issue FROM lottery_records ORDER BY issue DESC LIMIT 1");
            $row = $stmt->fetch();
            $nextIssue = $row ? $row['issue'] + 1 : '???';

            if ($json) {
                $pred = json_decode($json, true);
                
                $sxEmoji = ['鼠'=>'🐀','牛'=>'🐂','虎'=>'🐅','兔'=>'🐇','龙'=>'🐉','蛇'=>'🐍','马'=>'🐎','羊'=>'🐏','猴'=>'🐒','鸡'=>'🐓','狗'=>'🐕','猪'=>'🐖'];
                $sixXiaoStr = "";
                foreach ($pred['six_xiao'] as $sx) {
                    $sixXiaoStr .= ($sxEmoji[$sx]??'') . "*{$sx}* ";
                }
                
                $colorMap = ['red'=>'🔴 红波', 'blue'=>'🔵 蓝波', 'green'=>'🟢 绿波'];
                $waveStr = $colorMap[$pred['color_wave']] ?? '';

                $msg = "🕵️ *管理员预览*\n";
                $msg .= "🎯 *第 {$nextIssue} 期 综合分析*\n";
                $msg .= "----------------------\n";
                $msg .= "🦁 六肖：{$sixXiaoStr}\n";
                $msg .= "🌊 波色：{$waveStr}\n";
                $msg .= "----------------------\n";
                $msg .= "💡 基于热度、遗漏、连庄规律综合加权。";
                
                sendMsg($chatId, $msg);
            } else {
                sendMsg($chatId, "❌ 暂无预测数据，请先录入历史开奖。");
            }
        }
        
        // 3. 推送预测 (公开)
        elseif ($rawText === '🚀 推送预测到频道') {
            sendMsg($chatId, "🚀 正在发送...");
            require_once 'manual_push.php'; 
            sendMsg($chatId, "✅ 推送完成。");
        }
        
        // 4. 查看最新数据
        elseif ($rawText === '📊 查看最新录入') {
            $pdo = Db::connect();
            $stmt = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 1");
            $row = $stmt->fetch();
            if ($row) {
                sendMsg($chatId, "📅 *最新: 第 {$row['issue']} 期*\n🔢 `{$row['n1']} {$row['n2']} {$row['n3']} {$row['n4']} {$row['n5']} {$row['n6']} + {$row['spec']}`");
            } else {
                sendMsg($chatId, "📭 无数据");
            }
        }
        
        // 5. 设置生肖
        elseif ($rawText === '⚙️ 设置生肖数据') {
            $msg = "🛠 *生肖配置模式*\n\n请按 JSON 格式发送：\n`{\"鼠\":[1,13...], \"牛\":[2,14...], ...}`";
            sendMsg($chatId, $msg);
        }
        
        // 6. JSON 配置处理
        elseif (strpos(trim($rawText), '{') === 0) {
            $json = json_decode($rawText, true);
            if ($json && count($json) >= 12) {
                Settings::set('zodiac_config', $rawText);
                refreshAndSave(); // 配置变了，必须立即重算预测
                sendMsg($chatId, "✅ 生肖数据已更新！\n算法已重新校准。");
            } else {
                sendMsg($chatId, "❌ JSON 格式错误。");
            }
        }
        
        // 7. 隐形删除指令 (正则：删除xxxx)
        elseif (preg_match('/^删除(\d+)$/', $rawText, $delMatch)) {
            $delIssue = $delMatch[1];
            $pdo = Db::connect();
            $stmt = $pdo->prepare("DELETE FROM lottery_records WHERE issue = ?");
            $stmt->execute([$delIssue]);
            
            if ($stmt->rowCount() > 0) {
                refreshAndSave(); // 删除旧数据后，必须重算
                sendMsg($chatId, "🗑 已删除第 `{$delIssue}` 期。\n预测结果已自动修正。");
            } else {
                sendMsg($chatId, "⚠️ 找不到第 `{$delIssue}` 期。");
            }
        }
    }
}

echo 'ok';
?>
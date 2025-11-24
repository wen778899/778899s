<?php
require_once 'utils/Env.php';
require_once 'utils/Db.php';
require_once 'utils/LotteryLogic.php';
require_once 'utils/Settings.php';

Env::load(__DIR__ . '/.env');

// --- 辅助函数 ---
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

// --- 强力清洗函数 (核心修复) ---
function cleanText($text) {
    // 1. 将 URL 编码转回
    $text = urldecode($text);
    
    // 2. 核心：使用 Unicode 属性 \p{Z} 匹配所有种类的空格/不可见字符
    // 这一步能解决 NBSP、全角空格、Tab 等所有导致正则失效的符号
    $text = preg_replace('/\p{Z}+/u', ' ', $text);
    
    // 3. 去除所有非打印字符
    $text = preg_replace('/\p{C}+/u', ' ', $text);
    
    // 4. 将连续的普通空格合并
    $text = preg_replace('/\s+/', ' ', $text);
    
    return trim($text);
}

// ==========================================
// 1. 入口验证
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
// 2. 录入逻辑
// ==========================================

// 第一步：清洗
$text = cleanText($rawText);

// 第二步：提取期号
// 匹配：第2025xxx期，中间允许有冒号和空格
preg_match('/第[:：]?\s*(\d+)\s*期/u', $text, $issueMatch);

if (!empty($issueMatch)) {
    $issue = $issueMatch[1];
    
    // 技巧：先从文本中把期号去掉，防止期号里的数字干扰号码提取
    // 例如期号是 2025316，里面有 20, 25, 16 等数字
    $textWithoutIssue = str_replace($issue, '', $text);

    // 第三步：提取号码 (使用更稳健的正则)
    // (?<!\d) 表示前面不能是数字，(?!\d) 表示后面不能是数字
    // 这比 \b 更能适应复杂环境
    preg_match_all('/(?<!\d)(\d{2})(?!\d)/', $textWithoutIssue, $numMatches);

    // 过滤一下，只保留合理的彩票数字 (1-49)
    // 这一步可选，但能防止提取到比如 "99" 这种异常干扰项
    $validNums = [];
    foreach ($numMatches[1] as $n) { // 注意这里是 index 1
        $val = intval($n);
        if ($val >= 1 && $val <= 49) {
            $validNums[] = $n;
        }
    }

    // 如果找到了至少 7 个有效数字
    if (count($validNums) >= 7) {
        // 默认取前 7 个
        $nums = array_slice($validNums, 0, 7);
        
        try {
            $pdo = Db::connect();
            
            // 插入或更新
            $sql = "INSERT INTO lottery_records (issue, n1, n2, n3, n4, n5, n6, spec) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    n1=?, n2=?, n3=?, n4=?, n5=?, n6=?, spec=?";
                    
            $stmt = $pdo->prepare($sql);
            $params = array_merge([$issue], $nums, $nums);
            $stmt->execute($params);
            
            // 立即生成预测并保存
            $stmtAll = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 100");
            $newPred = LotteryLogic::predict($stmtAll->fetchAll());
            Settings::set('current_prediction', json_encode($newPred));
            
            // 如果是手动私聊发给 Bot 的，给个反馈
            if ($msgType === 'message') {
                sendMsg($chatId, "✅ 识别成功！\n第 {$issue} 期\n号码: " . implode(" ", $nums));
            }
            
        } catch (Exception $e) {
            if ($msgType === 'message') sendMsg($chatId, "❌ 数据库错误: " . $e->getMessage());
        }
        
        echo 'ok'; exit;
    } else {
        // 仅在私聊时提示失败，频道里保持安静
        if ($msgType === 'message' && strpos($rawText, '期') !== false) {
            sendMsg($chatId, "⚠️ 格式识别失败：找到了期号 {$issue}，但只找到了 " . count($validNums) . " 个有效数字(01-49)。");
        }
    }
}

// ==========================================
// 3. 菜单逻辑 (保持不变)
// ==========================================

if ($msgType === 'message') {
    $senderId = $data['from']['id'];
    $adminId = trim($_ENV['TG_ADMIN_ID']);

    if ((string)$senderId === (string)$adminId) {
        // ... 这里直接复制之前的 switch case 菜单逻辑 ...
        // 为了代码完整性，这里补全最常用的部分：
        $mainKeyboard = [
            'keyboard' => [
                [['text' => '🔮 生成/查看下期预测'], ['text' => '📊 查看最新录入']],
                [['text' => '✅ 开启自动推送'], ['text' => '🛑 关闭自动推送']]
            ],
            'resize_keyboard' => true,
            'persistent_keyboard' => true
        ];
        
        if ($rawText === '/start') {
             sendMsg($chatId, "👋 管理员面板", $mainKeyboard);
        } elseif ($rawText === '📊 查看最新录入') {
            $pdo = Db::connect();
            $stmt = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 1");
            $row = $stmt->fetch();
            if ($row) {
                sendMsg($chatId, "📅 *最新: 第 {$row['issue']} 期*\n🔢 `{$row['n1']} {$row['n2']} {$row['n3']} {$row['n4']} {$row['n5']} {$row['n6']} + {$row['spec']}`");
            }
        }
        // 其他菜单命令请保持原样...
        // 为节省篇幅，建议你把之前的 switch case 块直接贴在这里
        elseif ($rawText === '🔮 生成/查看下期预测') {
            $json = Settings::get('current_prediction');
            $pred = json_decode($json, true);
            $pdo = Db::connect();
            $stmt = $pdo->query("SELECT issue FROM lottery_records ORDER BY issue DESC LIMIT 1");
            $row = $stmt->fetch();
            $nextIssue = $row ? $row['issue'] + 1 : '???';
            if ($pred) {
                $sxStr = implode(" ", $pred['six_xiao']);
                $colorMap = ['red'=>'🔴','blue'=>'🔵','green'=>'🟢'];
                $wave = $colorMap[$pred['color_wave']] ?? '';
                sendMsg($chatId, "🔮 *第 {$nextIssue} 期 预测*\n六肖：`{$sxStr}`\n波色：{$wave}色");
            } else {
                sendMsg($chatId, "❌ 无预测数据");
            }
        }
        elseif ($rawText === '✅ 开启自动推送') {
            Settings::set('push_enabled', '1'); sendMsg($chatId, "✅ 已开启");
        }
        elseif ($rawText === '🛑 关闭自动推送') {
            Settings::set('push_enabled', '0'); sendMsg($chatId, "🛑 已关闭");
        }
    }
}

echo 'ok';
?>

<?php
// 这是一个手动强制刷新预测的工具脚本
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'utils/Env.php';
require_once 'utils/Db.php';
require_once 'utils/LotteryLogic.php';
require_once 'utils/Settings.php';
require_once 'utils/ZodiacManager.php';

Env::load(__DIR__ . '/.env');

try {
    $pdo = Db::connect();
    
    // 1. 读取最新的 150 期数据 (确保足够多)
    $stmt = $pdo->query("SELECT * FROM lottery_records ORDER BY issue DESC LIMIT 150");
    $history = $stmt->fetchAll();
    
    $count = count($history);
    echo "📊 当前数据库记录数: <b>{$count}</b> 期<br><br>";

    if ($count < 50) {
        echo "❌ 样本仍然不足 50 期，AI 无法启动。<br>";
    } else {
        echo "✅ 样本充足，正在启动 AI 回测引擎...<br>";
        
        // 2. 强制重新计算
        $pred = LotteryLogic::predict($history);
        
        // 3. 保存结果
        Settings::set('current_prediction', json_encode($pred));
        
        echo "<hr>";
        echo "🧠 <b>AI 模型已激活</b>: " . $pred['strategy_used'] . "<br>";
        echo "🦁 <b>六肖</b>: " . implode(" ", $pred['six_xiao']) . "<br>";
        echo "🔥 <b>三肖</b>: " . implode(" ", $pred['three_xiao']) . "<br>";
        echo "<br>🎉 <b>刷新成功！现在去 Bot 或前端网页查看，就是最新的结果了。</b>";
    }

} catch (Exception $e) {
    echo "错误: " . $e->getMessage();
}
?>
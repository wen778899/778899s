<?php
// 文件路径: backend/api/game/join.php
require_once __DIR__ . '/../../utils/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

$user_id = require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('仅支持POST方法', 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$score_type = $data['score'] ?? 0;
if (!in_array($score_type, [2, 5, 10])) {
    json_error('无效的分数场');
}

// 简化逻辑：这里我们只为单个玩家创建游戏并分配牌局。
// 真实的多人匹配系统会更复杂，需要处理房间、玩家等待、满员等状态。
// 为了项目启动，我们先实现一个“单人练习”模式的框架。

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();
    
    // 1. 获取一个未使用的牌局
    $stmt = $pdo->prepare("SELECT id, hand_data FROM pre_generated_hands WHERE is_used = false ORDER BY RAND() LIMIT 1 FOR UPDATE");
    $stmt->execute();
    $hand = $stmt->fetch();

    if (!$hand) {
        $pdo->rollBack();
        json_error('牌局库存不足，请联系管理员', 503);
    }
    
    // 2. 标记牌局为已使用
    $stmt = $pdo->prepare("UPDATE pre_generated_hands SET is_used = true, used_at = NOW() WHERE id = ?");
    $stmt->execute([$hand['id']]);

    // 3. 创建一个新的游戏记录
    $room_id = uniqid('room_', true); // 生成一个唯一的房间/游戏ID
    $hand_data = json_decode($hand['hand_data'], true);
    $player_cards = $hand_data['player1']; // 暂时只给当前玩家发牌

    // 初始发牌直接按3-5-5随机分配
    shuffle($player_cards);
    $initial_layout = [
        'head' => array_slice($player_cards, 0, 3),
        'middle' => array_slice($player_cards, 3, 5),
        'tail' => array_slice($player_cards, 8, 5)
    ];

    $players_data = [
        $user_id => [
            'cards' => $initial_layout,
            'submitted' => false,
            'public_id' => $_SESSION['public_id']
        ]
        // 其他玩家加入后会添加到这里
    ];

    $stmt = $pdo->prepare(
        "INSERT INTO games (room_id, score_type, hand_id, players_data, status) VALUES (?, ?, ?, ?, 'playing')"
    );
    $stmt->execute([$room_id, $score_type, $hand['id'], json_encode($players_data)]);
    $game_id = $pdo->lastInsertId();

    $pdo->commit();

    // 返回游戏ID和初始牌型
    json_response([
        'gameId' => $game_id,
        'cards' => $initial_layout
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('服务器内部错误: ' . $e->getMessage(), 500);
}
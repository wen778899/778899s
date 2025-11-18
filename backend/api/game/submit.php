<?php
// 文件路径: backend/api/game/submit.php
require_once __DIR__ . '/../../utils/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
// require_once __DIR__ . '/../../lib/ShisanshuiValidator.php'; // 实际项目中需要一个强大的验证器

$user_id = require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('仅支持POST方法', 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$game_id = $data['gameId'] ?? null;
$hand = $data['hand'] ?? null; // 格式: ['head'=>[...], 'middle'=>[...], 'tail'=>[...]]

if (!$game_id || !$hand) {
    json_error('无效的请求');
}

// TODO: 在真实项目中，这里必须有极其严格的服务端验证逻辑
// 1. 验证提交的13张牌是否和发给玩家的牌完全一致
// 2. 验证牌墩数量是否为3-5-5
// 3. 验证牌型大小顺序是否合法 (尾 > 中 > 头)
// $validator = new ShisanshuiValidator($original_cards, $submitted_hand);
// if (!$validator->isValid()) { json_error('无效的牌型'); }

try {
    $pdo = getDBConnection();
    
    // 简化逻辑：直接更新玩家状态为已提交
    // 在多人游戏中，还需要检查是否所有人都已提交，然后进行比牌
    $stmt = $pdo->prepare("SELECT players_data FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $game = $stmt->fetch();

    if (!$game) {
        json_error('游戏不存在', 404);
    }
    
    $players_data = json_decode($game['players_data'], true);

    if (!isset($players_data[$user_id])) {
        json_error('你不在这个游戏中', 403);
    }

    $players_data[$user_id]['cards'] = $hand;
    $players_data[$user_id]['submitted'] = true;

    $stmt = $pdo->prepare("UPDATE games SET players_data = ? WHERE id = ?");
    $stmt->execute([json_encode($players_data), $game_id]);

    json_response(['message' => '提交成功，等待其他玩家...']);

} catch (Exception $e) {
    json_error('服务器内部错误: ' . $e->getMessage(), 500);
}
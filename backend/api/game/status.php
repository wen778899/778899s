<?php
// 文件路径: backend/api/game/status.php
require_once __DIR__ . '/../../utils/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

require_auth();

$game_id = $_GET['gameId'] ?? null;
if (!$game_id) {
    json_error('需要提供游戏ID');
}

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT status, players_data FROM games WHERE id = ?");
    $stmt->execute([$game_id]);
    $game = $stmt->fetch();
    
    if (!$game) {
        json_error('游戏不存在', 404);
    }

    // 在真实项目中，如果所有人都提交了，这里会触发比牌逻辑，
    // 然后将status更新为'finished'，并返回比牌结果。
    // 目前简化为只返回当前状态。
    
    $players_data = json_decode($game['players_data'], true);
    
    // 过滤敏感信息，只返回提交状态
    $player_statuses = [];
    foreach($players_data as $id => $data){
        $player_statuses[] = [
            'public_id' => $data['public_id'],
            'submitted' => $data['submitted']
        ];
    }
    
    json_response([
        'status' => $game['status'],
        'players' => $player_statuses
    ]);

} catch (Exception $e) {
    json_error('服务器内部错误: ' . $e->getMessage(), 500);
}
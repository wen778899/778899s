<?php
// 文件路径: backend/api/user/me.php
require_once __DIR__ . '/../../utils/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

$user_id = require_auth();

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT public_id, phone, points FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $user = $stmt->fetch();

    if ($user) {
        json_response($user);
    } else {
        json_error('用户不存在', 404);
    }
} catch (Exception $e) {
    json_error('服务器内部错误: ' . $e->getMessage(), 500);
}
<?php
// 文件路径: backend/api/user/search.php
require_once __DIR__ . '/../../utils/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

require_auth();

$phone = $_GET['phone'] ?? '';

if (empty($phone)) {
    json_error('需要提供手机号');
}

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT public_id FROM users WHERE phone = ?");
    $stmt->execute([$phone]);
    $result = $stmt->fetch();

    if ($result) {
        json_response($result);
    } else {
        json_error('未找到该手机号对应的用户', 404);
    }
} catch (Exception $e) {
    json_error('服务器内部错误: ' . $e->getMessage(), 500);
}
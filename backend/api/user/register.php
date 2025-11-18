<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('仅支持POST方法', 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$phone = $data['phone'] ?? '';
$password = $data['password'] ?? '';

if (empty($phone) || empty($password)) {
    json_error('手机号和密码不能为空');
}

if (!preg_match('/^\d{5,15}$/', $phone)) {
    json_error('手机号格式不正确');
}

try {
    $pdo = getDBConnection();

    $stmt = $pdo->prepare("SELECT id FROM users WHERE phone = ?");
    $stmt->execute([$phone]);
    if ($stmt->fetch()) {
        json_error('该手机号已被注册', 409);
    }

    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    $public_id = generateUniquePublicId($pdo);
    
    $stmt = $pdo->prepare("INSERT INTO users (public_id, phone, password_hash) VALUES (?, ?, ?)");
    $stmt->execute([$public_id, $phone, $password_hash]);

    json_response(['message' => '注册成功', 'public_id' => $public_id], 201);

} catch (Exception $e) {
    json_error('服务器内部错误: ' . $e->getMessage(), 500);
}
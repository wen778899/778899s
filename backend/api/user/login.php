<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('仅支持POST方法', 405);
}

session_start();

$data = json_decode(file_get_contents('php://input'), true);
$phone = $data['phone'] ?? '';
$password = $data['password'] ?? '';

if (empty($phone) || empty($password)) {
    json_error('手机号和密码不能为空');
}

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT id, public_id, password_hash, points FROM users WHERE phone = ?");
    $stmt->execute([$phone]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['public_id'] = $user['public_id'];
        
        json_response([
            'message' => '登录成功',
            'user' => [
                'public_id' => $user['public_id'],
                'points' => $user['points']
            ]
        ]);
    } else {
        json_error('手机号或密码错误', 401);
    }

} catch (Exception $e) {
    json_error('服务器内部错误: ' . $e->getMessage(), 500);
}
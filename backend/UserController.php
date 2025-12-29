<?php
require_once 'BaseController.php';

class UserController extends BaseController {

    // 生成一个在数据库中唯一的4位公开ID
    private function generateUniquePublicId() {
        $chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        do {
            $public_id = '';
            for ($i = 0; $i < 4; $i++) {
                $public_id .= $chars[rand(0, strlen($chars) - 1)];
            }
            $stmt = $this->pdo->prepare("SELECT id FROM users WHERE public_id = ?");
            $stmt->execute([$public_id]);
        } while ($stmt->fetch());
        return $public_id;
    }

    // 用户注册
    public function register($data) {
        if (empty($data['phone_number']) || empty($data['password'])) {
            return ['success' => false, 'message' => '手机号或密码不能为空。'];
        }

        // 检查手机号是否已存在
        $stmt = $this->pdo->prepare("SELECT id FROM users WHERE phone_number = ?");
        $stmt->execute([$data['phone_number']]);
        if ($stmt->fetch()) {
            return ['success' => false, 'message' => '此手机号已被注册。'];
        }

        $public_id = $this->generateUniquePublicId();
        $password_hash = password_hash($data['password'], PASSWORD_DEFAULT);

        $stmt = $this->pdo->prepare(
            "INSERT INTO users (public_id, phone_number, password_hash, points) VALUES (?, ?, ?, ?)"
        );
        $success = $stmt->execute([$public_id, $data['phone_number'], $password_hash, 1000]); // 初始积分为1000

        return ['success' => $success, 'message' => $success ? '注册成功！' : '注册失败。'];
    }

    // 用户登录
    public function login($data) {
        if (empty($data['phone_number']) || empty($data['password'])) {
            return ['success' => false, 'message' => '手机号或密码不能为空。'];
        }

        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE phone_number = ?");
        $stmt->execute([$data['phone_number']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($data['password'], $user['password_hash'])) {
            // 登录成功，生成一个简单的 "Token" (实际项目中应使用JWT等)
            $token = base64_encode(json_encode([
                'user_id' => $user['id'],
                'expires' => time() + (86400 * 30) // 30天有效期
            ]));
            return ['success' => true, 'token' => $token, 'message' => '登录成功！'];
        } else {
            return ['success' => false, 'message' => '手机号或密码错误。'];
        }
    }

    // 按手机号搜索用户
    public function searchUser($data) {
        if (empty($data['phone_number'])) {
            return ['success' => false, 'message' => '请输入要搜索的手机号。'];
        }

        $stmt = $this->pdo->prepare("SELECT public_id, phone_number FROM users WHERE phone_number = ?");
        $stmt->execute([$data['phone_number']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            return ['success' => true, 'user' => $user];
        } else {
            return ['success' => false, 'message' => '未找到该用户。'];
        }
    }
    
    // 获取当前用户信息
    public function getCurrentUser() {
        $user = $this->getAuthenticatedUser();
        if (!$user) {
            http_response_code(401);
            return ['success' => false, 'message' => '未授权或登录状态已过期。'];
        }
        // 不要返回密码哈希
        unset($user['password_hash']);
        return ['success' => true, 'user' => $user];
    }

    // 赠送积分
    public function transferPoints($data) {
        $sender = $this->getAuthenticatedUser();
        if (!$sender) {
            http_response_code(401);
            return ['success' => false, 'message' => '请先登录。'];
        }

        if (empty($data['receiver_public_id']) || empty($data['amount'])) {
            return ['success' => false, 'message' => '接收方ID或金额不能为空。'];
        }
        
        $amount = (int)$data['amount'];
        if($amount <= 0) {
            return ['success' => false, 'message' => '赠送金额必须为正数。'];
        }

        // 检查接收方是否存在
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE public_id = ?");
        $stmt->execute([$data['receiver_public_id']]);
        $receiver = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$receiver) {
            return ['success' => false, 'message' => '接收方用户不存在。'];
        }
        
        if ($sender['id'] === $receiver['id']) {
             return ['success' => false, 'message' => '不能给自己赠送积分。'];
        }

        if ($sender['points'] < $amount) {
            return ['success' => false, 'message' => '您的积分余额不足。'];
        }

        try {
            $this->pdo->beginTransaction();

            // 扣除发送方积分
            $stmt1 = $this->pdo->prepare("UPDATE users SET points = points - ? WHERE id = ?");
            $stmt1->execute([$amount, $sender['id']]);

            // 增加接收方积分
            $stmt2 = $this->pdo->prepare("UPDATE users SET points = points + ? WHERE id = ?");
            $stmt2->execute([$amount, $receiver['id']]);
            
            // 记录交易历史
            $stmt3 = $this->pdo->prepare("INSERT INTO point_transfers (sender_id, receiver_id, amount) VALUES (?, ?, ?)");
            $stmt3->execute([$sender['id'], $receiver['id'], $amount]);

            $this->pdo->commit();
            return ['success' => true, 'message' => '赠送成功！'];

        } catch (Exception $e) {
            $this->pdo->rollBack();
            return ['success' => false, 'message' => '操作失败，请重试。', 'error' => $e->getMessage()];
        }
    }
}

<?php
// 文件路径: backend/lib/AdminLogic.php
class AdminLogic {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * 根据手机号或Public ID查找用户
     * @param string $identifier
     * @return array|false
     */
    public function findUser($identifier) {
        $stmt = $this->pdo->prepare("SELECT public_id, phone, points, created_at FROM users WHERE phone = :identifier OR public_id = :identifier");
        $stmt->execute([':identifier' => $identifier]);
        return $stmt->fetch();
    }

    /**
     * 修改用户积分
     * @param string $identifier
     * @param int $amount (可以是正数或负数)
     * @return string
     */
    public function updateUserPoints($identifier, $amount) {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("SELECT id, points FROM users WHERE phone = :identifier OR public_id = :identifier FOR UPDATE");
            $stmt->execute([':identifier' => $identifier]);
            $user = $stmt->fetch();

            if (!$user) {
                $this->pdo->rollBack();
                return "用户 `{$identifier}` 不存在！";
            }

            $new_points = $user['points'] + $amount;
            if ($new_points < 0) {
                $this->pdo->rollBack();
                return "操作失败，用户积分不能为负数！";
            }

            $stmt = $this->pdo->prepare("UPDATE users SET points = ? WHERE id = ?");
            $stmt->execute([$new_points, $user['id']]);

            $this->pdo->commit();

            $action = $amount >= 0 ? "增加" : "减少";
            return "操作成功！\n用户: `{$identifier}`\n{$action}: " . abs($amount) . " 分\n最新积分: *{$new_points}*";
        } catch (Exception $e) {
            $this->pdo->rollBack();
            return "数据库操作失败: " . $e->getMessage();
        }
    }

    /**
     * 删除用户
     * @param string $identifier
     * @return string
     */
    public function deleteUser($identifier) {
        $user = $this->findUser($identifier);
        if (!$user) {
            return "用户 `{$identifier}` 不存在！";
        }

        $stmt = $this->pdo->prepare("DELETE FROM users WHERE phone = :identifier OR public_id = :identifier");
        $stmt->execute([':identifier' => $identifier]);
        
        if ($stmt->rowCount() > 0) {
            return "用户 `{$identifier}` (手机号: {$user['phone']}) 已被成功删除。";
        } else {
            return "删除用户 `{$identifier}` 失败。";
        }
    }
}
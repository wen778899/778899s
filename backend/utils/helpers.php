<?php
function generateUniquePublicId($pdo) {
    $chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $id_length = 4;
    $max_attempts = 10;
    
    for ($i = 0; $i < $max_attempts; $i++) {
        $public_id = '';
        for ($j = 0; $j < $id_length; $j++) {
            $public_id .= $chars[rand(0, strlen($chars) - 1)];
        }

        $stmt = $pdo->prepare("SELECT id FROM users WHERE public_id = ?");
        $stmt->execute([$public_id]);
        if ($stmt->fetch() === false) {
            return $public_id;
        }
    }
    
    // 如果10次都失败，说明ID池很满了，可以抛出异常
    throw new Exception("无法生成唯一的Public ID");
}
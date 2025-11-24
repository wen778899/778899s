<?php
class Env {
    public static function load($path) {
        if (!file_exists($path)) return;
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            // 去除行内的注释 (比如 KEY=VALUE #注释)
            $parts = explode('#', $line);
            $line = trim($parts[0]);
            
            if (empty($line)) continue;
            
            // 确保有等号
            if (strpos($line, '=') !== false) {
                list($name, $value) = explode('=', $line, 2);
                // 核心修复：强制 trim 去除首尾空格和换行
                $_ENV[trim($name)] = trim($value);
            }
        }
    }
}
?>
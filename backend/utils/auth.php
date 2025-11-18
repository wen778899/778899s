<?php
function require_auth() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['user_id'])) {
        require_once __DIR__ . '/response.php';
        json_error('未授权的访问', 401);
    }
    return $_SESSION['user_id'];
}
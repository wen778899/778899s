<?php
class Db {
    private static $pdo = null;
    public static function connect() {
        if (self::$pdo !== null) return self::$pdo;
        $host = $_ENV['DB_HOST']; $db = $_ENV['DB_NAME'];
        $user = $_ENV['DB_USER']; $pass = $_ENV['DB_PASS'];
        $dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
        $options = [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC];
        try { self::$pdo = new PDO($dsn, $user, $pass, $options); return self::$pdo; } 
        catch (\PDOException $e) { throw new \PDOException($e->getMessage(), (int)$e->getCode()); }
    }
}
?>
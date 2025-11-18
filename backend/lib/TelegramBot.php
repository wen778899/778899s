<?php
// 文件路径: backend/lib/TelegramBot.php
class TelegramBot {
    private $token;
    private $api_url = "https://api.telegram.org/bot";

    public function __construct($token) {
        $this->token = $token;
    }

    public function sendMessage($chat_id, $text) {
        $url = $this->api_url . $this->token . "/sendMessage";
        $data = [
            'chat_id' => $chat_id,
            'text' => $text,
            'parse_mode' => 'Markdown'
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            // 在生产环境中，应该记录日志而不是直接输出
            error_log("Telegram API Error: " . $error);
            return false;
        }
        return json_decode($response, true);
    }
}
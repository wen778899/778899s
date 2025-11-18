<?php
// 文件路径: backend/lib/GameLogic.php
class GameLogic {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function getUnusedHandsCount() {
        $stmt = $this->pdo->query("SELECT COUNT(*) as count FROM pre_generated_hands WHERE is_used = false");
        return $stmt->fetchColumn();
    }

    public function generateNewHands($count) {
        $suits = ['H', 'S', 'D', 'C']; // Hearts, Spades, Diamonds, Clubs
        $ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        $deck = [];
        foreach ($suits as $suit) {
            foreach ($ranks as $rank) {
                $deck[] = $suit . $rank;
            }
        }
        
        $sql = "INSERT INTO pre_generated_hands (hand_data) VALUES (?)";
        $stmt = $this->pdo->prepare($sql);
        
        $generated_count = 0;
        for ($i = 0; $i < $count; $i++) {
            shuffle($deck);
            $hand_data = [
                'player1' => array_slice($deck, 0, 13),
                'player2' => array_slice($deck, 13, 13),
                'player3' => array_slice($deck, 26, 13),
                'player4' => array_slice($deck, 39, 13),
            ];
            $stmt->execute([json_encode($hand_data)]);
            $generated_count++;
        }
        return $generated_count;
    }

    // 在这里添加其他游戏逻辑，比如比牌、计分等
}
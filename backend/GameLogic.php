<?php
class GameLogic {

    const CARD_VALUES = [
        '2' => 2, '3' => 3, '4' => 4, '5' => 5, '6' => 6, '7' => 7, '8' => 8, '9' => 9, '10' => 10, 'J' => 11, 'Q' => 12, 'K' => 13, 'A' => 14
    ];

    const TYPES = [
        'HIGH_CARD' => 1, 'PAIR' => 2, 'TWO_PAIR' => 3, 'THREE_OF_A_KIND' => 4, 'STRAIGHT' => 5,
        'FLUSH' => 6, 'FULL_HOUSE' => 7, 'FOUR_OF_A_KIND' => 8, 'STRAIGHT_FLUSH' => 9
    ];

    // ... (其他游戏逻辑函数将在这里实现) ...
    // 由于PHP的特性，实现复杂的组合算法会很冗长
    // 我们先创建一个基础版本，后续再填充完整的AI

    public static function getHandType($cards) {
        // 这个函数的逻辑会和JS版本非常相似
        // ...
        // 为了快速搭建框架，我们先返回一个模拟结果
        if (empty($cards)) return ['type' => 0, 'power' => 0, 'cards' => []];

        $power = 0;
        foreach ($cards as $card) {
            $power += self::CARD_VALUES[$card['value']];
        }

        return [
            'type' => self::TYPES['HIGH_CARD'],
            'power' => $power,
            'cards' => $cards
        ];
    }
    
    public static function compareHands($h1, $h2) {
        if ($h1['type'] > $h2['type']) return 1;
        if ($h1['type'] < $h2['type']) return -1;
        if ($h1['power'] > $h2['power']) return 1;
        if ($h1['power'] < $h2['power']) return -1;
        return 0;
    }

    public static function autoSort($cards) {
        // 简化版的AI：仅按大小排序，不做复杂组合
        usort($cards, function($a, $b) {
            return self::CARD_VALUES[$b['value']] - self::CARD_VALUES[$a['value']];
        });

        return [
            'back'  => self::getHandType(array_slice($cards, 0, 5)),
            'middle' => self::getHandType(array_slice($cards, 5, 5)),
            'front'  => self::getHandType(array_slice($cards, 10, 3))
        ];
    }
    
    public static function createDeck() {
        $suits = ['spades', 'hearts', 'clubs', 'diamonds'];
        $values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        $deck = [];
        foreach ($suits as $suit) {
            foreach ($values as $value) {
                $deck[] = ['suit' => $suit, 'value' => $value, 'rank' => $value, 'image' => self::getCardImage($suit, $value)];
            }
        }
        return $deck;
    }

    private static function getCardImage($suit, $value) {
        $s = ['spades' => 'S', 'hearts' => 'H', 'clubs' => 'C', 'diamonds' => 'D'];
        $v = ['10' => 'T', 'J' => 'J', 'Q' => 'Q', 'K' => 'K', 'A' => 'A'];
        $val = strlen($value) > 1 ? $v[$value] : $value;
        return "cards/{$val}{$s[$suit]}.svg";
    }
}

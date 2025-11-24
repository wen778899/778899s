<?php
require_once 'Db.php';
require_once 'Settings.php';

class ZodiacManager {
    // 波色是永恒不变的，直接硬编码
    public static $colors = [
        'red'   => [1,2,7,8,12,13,18,19,23,24,29,30,34,35,40,45,46],
        'blue'  => [3,4,9,10,14,15,20,25,26,31,36,37,41,42,47,48],
        'green' => [5,6,11,16,17,21,22,27,28,32,33,38,39,43,44,49]
    ];

    // 获取当前的生肖配置 (优先读库，没有则返回默认)
    public static function getMapping() {
        $json = Settings::get('zodiac_config');
        if ($json) {
            return json_decode($json, true);
        }

        // 默认配置 (2025年示例)
        return [
            '蛇' => [1, 13, 25, 37, 49],
            '龙' => [2, 14, 26, 38],
            '兔' => [3, 15, 27, 39],
            '虎' => [4, 16, 28, 40],
            '牛' => [5, 17, 29, 41],
            '鼠' => [6, 18, 30, 42],
            '猪' => [7, 19, 31, 43],
            '狗' => [8, 20, 32, 44],
            '鸡' => [9, 21, 33, 45],
            '猴' => [10, 22, 34, 46],
            '羊' => [11, 23, 35, 47],
            '马' => [12, 24, 36, 48]
        ];
    }

    // 根据数字查生肖和波色
    public static function getInfo($num) {
        $num = intval($num);
        $zodiacMap = self::getMapping();
        
        $myZodiac = '';
        foreach ($zodiacMap as $z => $nums) {
            if (in_array($num, $nums)) { $myZodiac = $z; break; }
        }

        $myColor = '';
        foreach (self::$colors as $c => $nums) {
            if (in_array($num, $nums)) { $myColor = $c; break; }
        }

        return ['num' => $num, 'zodiac' => $myZodiac, 'color' => $myColor];
    }
}
?>
<?php
require_once 'Db.php';
require_once 'Settings.php';

class ZodiacManager {
    // 固定的波色数据
    public static $colors = [
        'red'   => [1,2,7,8,12,13,18,19,23,24,29,30,34,35,40,45,46],
        'blue'  => [3,4,9,10,14,15,20,25,26,31,36,37,41,42,47,48],
        'green' => [5,6,11,16,17,21,22,27,28,32,33,38,39,43,44,49]
    ];

    // 生肖关系模板 (用于规律推算)
    // 三合：吉配，容易连续出现
    // 六合：贵人，容易伴随出现
    public static $relations = [
        '鼠' => ['三合'=>['龙','猴'], '六合'=>['牛']],
        '牛' => ['三合'=>['蛇','鸡'], '六合'=>['鼠']],
        '虎' => ['三合'=>['马','狗'], '六合'=>['猪']],
        '兔' => ['三合'=>['猪','羊'], '六合'=>['狗']],
        '龙' => ['三合'=>['鼠','猴'], '六合'=>['鸡']],
        '蛇' => ['三合'=>['鸡','牛'], '六合'=>['猴']],
        '马' => ['三合'=>['虎','狗'], '六合'=>['羊']],
        '羊' => ['三合'=>['兔','猪'], '六合'=>['马']],
        '猴' => ['三合'=>['鼠','龙'], '六合'=>['蛇']],
        '鸡' => ['三合'=>['蛇','牛'], '六合'=>['龙']],
        '狗' => ['三合'=>['虎','马'], '六合'=>['兔']],
        '猪' => ['三合'=>['兔','羊'], '六合'=>['虎']]
    ];

    // 获取当前生肖映射
    public static function getMapping() {
        $json = Settings::get('zodiac_config');
        if ($json) return json_decode($json, true);
        
        // 2025年 默认配置
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

    // 获取某个生肖的关联生肖 (三合+六合)
    public static function getRelatedZodiacs($zodiac) {
        if (!isset(self::$relations[$zodiac])) return [];
        return array_merge(self::$relations[$zodiac]['三合'], self::$relations[$zodiac]['六合']);
    }
}
?>
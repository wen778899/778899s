<?php
class LotteryLogic {
    // 按照你提供的 2025 年配置硬编码
    private static $config = [
        '鼠' => [6, 18, 30, 42],
        '牛' => [5, 17, 29, 41],
        '虎' => [4, 16, 28, 40],
        '兔' => [3, 15, 27, 39],
        '龙' => [2, 14, 26, 38],
        '蛇' => [1, 13, 25, 37, 49],
        '马' => [12, 24, 36, 48],
        '羊' => [11, 23, 35, 47],
        '猴' => [10, 22, 34, 46],
        '鸡' => [9, 21, 33, 45],
        '狗' => [8, 20, 32, 44],
        '猪' => [7, 19, 31, 43]
    ];

    private static $colors = [
        'red'   => [1,2,7,8,12,13,18,19,23,24,29,30,34,35,40,45,46],
        'blue'  => [3,4,9,10,14,15,20,25,26,31,36,37,41,42,47,48],
        'green' => [5,6,11,16,17,21,22,27,28,32,33,38,39,43,44,49]
    ];

    // 根据数字获取详细信息
    public static function getInfo($num) {
        $num = intval($num);
        $zodiac = '';
        $color = '';
        $parity = ($num % 2 == 0) ? '双' : '单';

        foreach (self::$config as $z => $nums) {
            if (in_array($num, $nums)) { $zodiac = $z; break; }
        }
        foreach (self::$colors as $c => $nums) {
            if (in_array($num, $nums)) { $color = $c; break; }
        }

        return ['num' => $num, 'zodiac' => $zodiac, 'color' => $color, 'parity' => $parity];
    }

    // 预测算法：预测下一期的特码属性
    public static function predict($history) {
        // 简单的统计学预测逻辑
        $zodiacCounts = [];
        $colorCounts = ['red' => 0, 'blue' => 0, 'green' => 0];

        // 1. 统计历史特码
        foreach ($history as $row) {
            $info = self::getInfo($row['spec']);
            $z = $info['zodiac'];
            $c = $info['color'];
            
            if (!isset($zodiacCounts[$z])) $zodiacCounts[$z] = 0;
            $zodiacCounts[$z]++;
            $colorCounts[$c]++;
        }

        // 2. 六肖预测策略：3个热号 + 2个冷号 + 1个随机
        arsort($zodiacCounts); // 降序排列
        $hotZodiacs = array_keys(array_slice($zodiacCounts, 0, 3));
        
        $allZodiacs = array_keys(self::$config);
        $missingOrCold = array_diff($allZodiacs, array_keys($zodiacCounts)); // 完全没出现的
        if (empty($missingOrCold)) {
            $missingOrCold = array_keys(array_slice($zodiacCounts, -3)); // 或者出现最少的
        }
        $coldZodiacs = array_slice($missingOrCold, 0, 2);

        $prediction = array_merge($hotZodiacs, $coldZodiacs);
        
        // 补足 6 个 (随机)
        while (count($prediction) < 6) {
            $rand = $allZodiacs[array_rand($allZodiacs)];
            if (!in_array($rand, $prediction)) $prediction[] = $rand;
        }

        // 3. 波色预测：简单的概率反转 (如果红色出太多，就猜别的)
        asort($colorCounts); // 升序，取出最少的颜色
        $predictedColor = array_key_first($colorCounts); 

        return [
            'six_xiao' => $prediction,
            'color_wave' => $predictedColor
        ];
    }
}
?>
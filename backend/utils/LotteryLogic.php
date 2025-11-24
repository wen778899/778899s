<?php
require_once 'ZodiacManager.php';

class LotteryLogic {
    
    /**
     * 核心辅助：获取数字特征
     */
    private static function getNumFeatures($num) {
        $n = intval($num);
        return [
            'tail' => $n % 10, // 尾数
            'head' => floor($n / 10), // 头数
            'zodiac' => ZodiacManager::getInfo($n)['zodiac'],
            'color' => ZodiacManager::getInfo($n)['color'],
            'element' => ZodiacManager::getInfo($n)['element']
        ];
    }

    /**
     * 策略 A: 尾数追踪法 (Tail Tracking)
     * 统计最近 7 个号码的尾数热度，推算下期特码尾数
     */
    private static function scoreByTail($history, &$scores) {
        $zodiacMap = ZodiacManager::getMapping();
        $tailCounts = array_fill(0, 10, 0);

        // 统计最近 5 期的所有号码(平码+特码)的尾数
        for ($i = 0; $i < 5; $i++) {
            $row = $history[$i];
            for ($j = 1; $j <= 6; $j++) $tailCounts[$row["n$j"] % 10]++;
            $tailCounts[$row['spec'] % 10] += 2; // 特码尾数权重加倍
        }

        // 找出最热的 3 个尾数
        arsort($tailCounts);
        $hotTails = array_slice(array_keys($tailCounts), 0, 3);

        // 给符合热尾数的生肖加分
        foreach ($scores as $z => $s) {
            $nums = $zodiacMap[$z];
            foreach ($nums as $n) {
                if (in_array($n % 10, $hotTails)) {
                    $scores[$z] += 2; // 命中热尾加分
                }
            }
        }
    }

    /**
     * 策略 B: 五行缺失回补法 (Element Missing)
     * 统计上一期 7 个号码的五行，找出没出现的五行，下期特码极大可能就是它
     */
    private static function scoreByElement($history, &$scores) {
        $lastRow = $history[0];
        $existElements = [];
        
        // 收集上期出现过的五行
        for ($j = 1; $j <= 6; $j++) {
            $existElements[] = ZodiacManager::getInfo($lastRow["n$j"])['element'];
        }
        $existElements[] = ZodiacManager::getInfo($lastRow['spec'])['element'];
        $existElements = array_unique($existElements);

        // 定义所有五行
        $allElements = ['金', '木', '水', '火', '土'];
        
        // 找出缺失的五行
        $missing = array_diff($allElements, $existElements);

        // 给缺失五行的生肖加巨分
        $zodiacMap = ZodiacManager::getMapping();
        foreach ($scores as $z => $s) {
            $nums = $zodiacMap[$z];
            foreach ($nums as $n) {
                $e = ZodiacManager::getInfo($n)['element'];
                if (in_array($e, $missing)) {
                    $scores[$z] += 3; // 缺失回补权重很高
                    break; 
                }
            }
        }
    }

    /**
     * 策略 C: 头数跟随法 (Head Following)
     * 如果上期平码多为 2头(20-29)，下期特码容易开 2头
     */
    private static function scoreByHead($history, &$scores) {
        $lastRow = $history[0];
        $headCounts = array_fill(0, 5, 0); // 0-4头

        for ($j = 1; $j <= 6; $j++) {
            $h = floor($lastRow["n$j"] / 10);
            $headCounts[$h]++;
        }
        
        arsort($headCounts);
        $hotHead = array_key_first($headCounts); // 最热头数

        $zodiacMap = ZodiacManager::getMapping();
        foreach ($scores as $z => $s) {
            $nums = $zodiacMap[$z];
            foreach ($nums as $n) {
                if (floor($n / 10) == $hotHead) {
                    $scores[$z] += 1.5;
                }
            }
        }
    }

    /**
     * 策略 D: 综合走势 (Classic Trend)
     * 保留之前的经典热度分析，作为保底
     */
    private static function scoreByTrend($history, &$scores) {
        for ($i = 0; $i < 20; $i++) {
            $z = ZodiacManager::getInfo($history[$i]['spec'])['zodiac'];
            $scores[$z] += 2; // 简单热度
        }
    }

    /**
     * 杀号逻辑 (Killer)
     * 杀掉上一期的特码生肖 (连庄概率其实很低，杀掉它是大概率正确的)
     */
    private static function applyKiller($history, &$scores) {
        $lastZ = ZodiacManager::getInfo($history[0]['spec'])['zodiac'];
        $scores[$lastZ] -= 10; // 大幅扣分，变相杀肖
        return $lastZ;
    }

    /**
     * 主预测入口
     */
    public static function predict($history) {
        if (count($history) < 10) return []; // 数据太少不算

        $zodiacMap = ZodiacManager::getMapping();
        $allZodiacs = array_keys($zodiacMap);
        $scores = array_fill_keys($allZodiacs, 0);

        // --- 执行多维分析 ---
        self::scoreByTail($history, $scores);    // 尾数维度
        self::scoreByElement($history, $scores); // 五行维度
        self::scoreByHead($history, $scores);    // 头数维度
        self::scoreByTrend($history, $scores);   // 历史维度
        
        // --- 杀号 ---
        $killed = self::applyKiller($history, $scores);

        // --- 排序输出 ---
        arsort($scores);
        $ranked = array_keys($scores);

        $sixXiao = array_slice($ranked, 0, 6);
        $threeXiao = array_slice($ranked, 0, 3);

        // --- 波色推算 (基于预测结果的前6肖所含号码的波色统计) ---
        $waveCounts = ['red'=>0, 'blue'=>0, 'green'=>0];
        foreach ($sixXiao as $z) {
            $nums = $zodiacMap[$z];
            foreach ($nums as $n) {
                $info = ZodiacManager::getInfo($n);
                $waveCounts[$info['color']]++;
            }
        }
        arsort($waveCounts);
        $waves = array_keys($waveCounts);

        return [
            'six_xiao' => $sixXiao,
            'three_xiao' => $threeXiao,
            'color_wave' => ['primary'=>$waves[0], 'secondary'=>$waves[1]],
            'strategy_used' => "全维特征流 | 杀:{$killed}"
        ];
    }
}
?>
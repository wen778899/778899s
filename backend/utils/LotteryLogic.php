<?php
require_once 'ZodiacManager.php';

class LotteryLogic {
    
    /**
     * 高级多维加权预测引擎 (v2.0)
     * 新增：精选三肖、双波色推荐、波色权重与生肖联动
     */
    public static function predict($history) {
        if (empty($history)) return [];

        $zodiacMap = ZodiacManager::getMapping();
        $allZodiacs = array_keys($zodiacMap);
        
        // --- 初始化记分板 ---
        $scores = [];
        foreach ($allZodiacs as $z) $scores[$z] = 0;

        // =============================================
        // 维度 1: 热度分析 (Trend) - 权重 35%
        // =============================================
        $limitShort = min(count($history), 10);
        $limitMid = min(count($history), 30);
        
        for ($i = 0; $i < $limitMid; $i++) {
            $row = $history[$i];
            $info = ZodiacManager::getInfo($row['spec']);
            $z = $info['zodiac'];

            if ($i < $limitShort) {
                $scores[$z] += 3.5; // 近10期出现，极热
            } else {
                $scores[$z] += 1.2; // 10-30期出现，温热
            }
        }

        // =============================================
        // 维度 2: 遗漏值分析 (Omission) - 权重 25%
        // =============================================
        foreach ($allZodiacs as $z) {
            $omissionCount = 0;
            foreach ($history as $row) {
                $info = ZodiacManager::getInfo($row['spec']);
                if ($info['zodiac'] === $z) break;
                $omissionCount++;
            }
            // 遗漏补偿算法：遗漏越大，反弹分越高
            $scores[$z] += floor($omissionCount / 12) * 2.5;
        }

        // =============================================
        // 维度 3: 规律模板 (Pattern) - 权重 30%
        // =============================================
        if (isset($history[0])) {
            $lastRow = $history[0];
            $lastInfo = ZodiacManager::getInfo($lastRow['spec']);
            $lastZodiac = $lastInfo['zodiac'];

            // 连庄 (Repeat)
            $scores[$lastZodiac] += 2; 

            // 三合六合 (Harmony)
            $related = ZodiacManager::getRelatedZodiacs($lastZodiac);
            foreach ($related as $relZ) {
                $scores[$relZ] += 4; 
            }
        }

        // =============================================
        // 维度 4: 波色平衡 (Color Balance) - 权重 10%
        // =============================================
        // 统计近期波色，给弱势波色生肖微调加分
        $colorCounts = ['red'=>0, 'blue'=>0, 'green'=>0];
        $limitColor = min(count($history), 20);
        for ($i = 0; $i < $limitColor; $i++) {
            $info = ZodiacManager::getInfo($history[$i]['spec']);
            if (isset($colorCounts[$info['color']])) $colorCounts[$info['color']]++;
        }
        asort($colorCounts);
        $weakestColor = array_key_first($colorCounts);
        
        foreach ($allZodiacs as $z) {
            // 如果该生肖包含弱势波色的号码，略微加分
            $nums = $zodiacMap[$z];
            foreach ($nums as $n) {
                if (ZodiacManager::getInfo($n)['color'] === $weakestColor) {
                    $scores[$z] += 1.5;
                    break; 
                }
            }
        }

        // =============================================
        // 结算: 生肖排名
        // =============================================
        arsort($scores);
        $rankedZodiacs = array_keys($scores);
        
        // 1. 获取六肖 (基础防线)
        $sixXiao = array_slice($rankedZodiacs, 0, 6);
        
        // 2. 获取三肖 (核心重点) - 直接取分数最高的前3名
        $threeXiao = array_slice($rankedZodiacs, 0, 3);

        // =============================================
        // 结算: 波色预测 (基于生肖分数的加权)
        // =============================================
        // 逻辑：如果预测的生肖大部分是红波，那我们就有理由推红波
        $waveScores = ['red'=>0, 'blue'=>0, 'green'=>0];
        
        // 取前 6 名生肖，将其分数贡献给对应的波色
        // 注意：一个生肖包含多种波色，需要按该生肖下的号码波色比例分配
        foreach ($sixXiao as $index => $z) {
            $zScore = $scores[$z]; // 该生肖的总分
            $nums = $zodiacMap[$z];
            
            // 简单化：获取该生肖的主波色（拥有号码最多的波色）
            $zColorCounts = ['red'=>0, 'blue'=>0, 'green'=>0];
            foreach ($nums as $n) {
                $c = ZodiacManager::getInfo($n)['color'];
                $zColorCounts[$c]++;
            }
            arsort($zColorCounts);
            $mainColor = array_key_first($zColorCounts);
            
            // 排名越靠前，对波色贡献越大
            $waveScores[$mainColor] += ($zScore * (1 - $index * 0.1));
        }

        // 排序波色得分
        arsort($waveScores);
        $rankedWaves = array_keys($waveScores);

        // 返回前两名波色
        return [
            'six_xiao'   => $sixXiao,
            'three_xiao' => $threeXiao, // 新增
            'color_wave' => [           // 改为数组：[主, 防]
                'primary'   => $rankedWaves[0],
                'secondary' => $rankedWaves[1]
            ],
            'debug_scores' => array_slice($scores, 0, 6)
        ];
    }
}
?>
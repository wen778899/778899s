<?php
require_once 'ZodiacManager.php';

class LotteryLogic {
    
    /**
     * 高级多维加权预测引擎
     * 结合：历史热度 + 遗漏回补 + 规律模板 + 波色平衡
     */
    public static function predict($history) {
        if (empty($history)) return [];

        $zodiacMap = ZodiacManager::getMapping();
        $allZodiacs = array_keys($zodiacMap);
        
        // --- 初始化记分板 ---
        $scores = [];
        foreach ($allZodiacs as $z) $scores[$z] = 0;

        // --- 1. 热度分析 (Trend Analysis) - 权重 30% ---
        // 统计最近 10期(短期) 和 30期(中期) 的出现频率
        $limitShort = min(count($history), 10);
        $limitMid = min(count($history), 30);
        
        for ($i = 0; $i < $limitMid; $i++) {
            $row = $history[$i];
            $info = ZodiacManager::getInfo($row['spec']);
            $z = $info['zodiac'];

            if ($i < $limitShort) {
                $scores[$z] += 3; // 近10期出现，加高分 (追热)
            } else {
                $scores[$z] += 1; // 10-30期出现，加低分
            }
        }

        // --- 2. 遗漏值分析 (Omission) - 权重 20% ---
        // 寻找很久没出的生肖 (博反弹)
        foreach ($allZodiacs as $z) {
            $omissionCount = 0;
            foreach ($history as $row) {
                $info = ZodiacManager::getInfo($row['spec']);
                if ($info['zodiac'] === $z) break;
                $omissionCount++;
            }
            // 遗漏每超过10期，加 2 分
            $scores[$z] += floor($omissionCount / 10) * 2;
        }

        // --- 3. 规律模板匹配 (Pattern Templates) - 权重 30% ---
        // 基于上一期结果，推算下一期
        if (isset($history[0])) {
            $lastRow = $history[0];
            $lastInfo = ZodiacManager::getInfo($lastRow['spec']);
            $lastZodiac = $lastInfo['zodiac'];

            // A. 连庄规律 (上期开啥，下期还开啥)
            // 历史统计显示连庄概率约为 10%
            $scores[$lastZodiac] += 2; 

            // B. 三合六合规律 (最强规律)
            // 如果上期是龙，下期开 鼠/猴/鸡 的概率极高
            $related = ZodiacManager::getRelatedZodiacs($lastZodiac);
            foreach ($related as $relZ) {
                $scores[$relZ] += 4; // 关联生肖大幅加分
            }
        }

        // --- 4. 波色平衡分析 (Color Balance) - 权重 20% ---
        // 统计近20期波色，找出弱势波色进行回补
        $colorStats = ['red'=>0, 'blue'=>0, 'green'=>0];
        $limitColor = min(count($history), 20);
        for ($i = 0; $i < $limitColor; $i++) {
            $info = ZodiacManager::getInfo($history[$i]['spec']);
            if (isset($colorStats[$info['color']])) $colorStats[$info['color']]++;
        }
        
        // 找出出现次数最少的波色 (弱势波色)
        asort($colorStats);
        $weakestColor = array_key_first($colorStats);
        
        // 给属于该弱势波色的所有数字对应的生肖加分
        // 注意：一个生肖有多个数字，只要有一个数字属于该波色，就加分
        foreach ($allZodiacs as $z) {
            $nums = $zodiacMap[$z];
            foreach ($nums as $n) {
                $c = ZodiacManager::getInfo($n)['color'];
                if ($c === $weakestColor) {
                    $scores[$z] += 2; // 波色回补加分
                    break; // 该生肖加一次即可
                }
            }
        }

        // --- 5. 最终结算 ---
        // 按分数降序排列
        arsort($scores);
        
        // 取前 6 名
        $sixXiao = array_slice(array_keys($scores), 0, 6);

        // 预测波色：直接取分数最高的生肖对应的波色，或者取回补波色
        // 这里策略是：取 Top1 生肖的主波色
        $topZodiac = $sixXiao[0];
        // 找到该生肖下最热的波色
        $topZodiacNums = $zodiacMap[$topZodiac];
        $bestColor = ZodiacManager::getInfo($topZodiacNums[0])['color'];

        return [
            'six_xiao' => $sixXiao,
            'color_wave' => $bestColor,
            'scores_debug' => array_slice($scores, 0, 6) // 调试用，看谁分高
        ];
    }
}
?>
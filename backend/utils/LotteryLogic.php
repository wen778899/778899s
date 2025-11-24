<?php
require_once 'ZodiacManager.php';

class LotteryLogic {
    
    /**
     * 核心预测算法
     * @param array $history 最近的历史记录 (建议传入100期)
     * @return array 预测结果
     */
    public static function predict($history) {
        if (empty($history)) return [];

        $zodiacMap = ZodiacManager::getMapping();
        $zodiacScores = []; // 生肖得分表
        $colorStats = ['red'=>0, 'blue'=>0, 'green'=>0]; // 波色统计

        // 初始化所有生肖得分为0
        foreach (array_keys($zodiacMap) as $z) $zodiacScores[$z] = 0;

        // --- 1. 数据统计 (最近 50 期权重最高) ---
        $recentLimit = min(count($history), 50);
        
        for ($i = 0; $i < $recentLimit; $i++) {
            $row = $history[$i];
            $info = ZodiacManager::getInfo($row['spec']); // 获取特码信息
            
            // 统计波色
            if (isset($colorStats[$info['color']])) {
                $colorStats[$info['color']]++;
            }

            // 统计生肖热度 (越近的期数权重越高)
            // 权重算法：当前期权重 1.0，50期前权重 0.1
            $weight = 1 + (($recentLimit - $i) / $recentLimit);
            
            if (isset($zodiacScores[$info['zodiac']])) {
                $zodiacScores[$info['zodiac']] += (10 * $weight); // 热度加分
            }
        }

        // --- 2. 遗漏值分析 (Omission) ---
        // 查找每个生肖多少期没出了，遗漏越久，回补概率越大（加分）
        foreach (array_keys($zodiacMap) as $z) {
            $omission = 0;
            foreach ($history as $row) {
                $info = ZodiacManager::getInfo($row['spec']);
                if ($info['zodiac'] === $z) break;
                $omission++;
            }
            // 遗漏加分：每遗漏1期加 2 分
            $zodiacScores[$z] += ($omission * 2);
        }

        // --- 3. 排序与筛选 ---
        // 按分数从高到低排序
        arsort($zodiacScores);
        
        // 策略：取分数最高的 6 个生肖 (热度+遗漏综合分)
        $sixXiao = array_slice(array_keys($zodiacScores), 0, 6);

        // --- 4. 波色预测 ---
        // 策略：杀弱项。统计最弱的波色，排除它，然后在剩下两个里选走势强的一个
        asort($colorStats); // 升序，第一个是最弱的
        $weakestColor = array_key_first($colorStats);
        unset($colorStats[$weakestColor]); 
        // 剩下两个里选最强的
        arsort($colorStats);
        $bestColor = array_key_first($colorStats);

        return [
            'six_xiao' => $sixXiao,
            'color_wave' => $bestColor
        ];
    }

    // 获取格式化后的详细信息 (给 API 用)
    public static function getInfo($num) {
        return ZodiacManager::getInfo($num);
    }
}
?>
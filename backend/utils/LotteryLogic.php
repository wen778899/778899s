<?php
require_once 'ZodiacManager.php';

class LotteryLogic {
    
    // 基础打分计算器
    private static function calculateScores($history, $weights) {
        $zodiacMap = ZodiacManager::getMapping();
        $allZodiacs = array_keys($zodiacMap);
        $scores = array_fill_keys($allZodiacs, 0);

        // 统计各项属性的出现次数 (用于平衡分析)
        $stats = [
            'jy' => ['家禽'=>0, '野兽'=>0],
            'td' => ['天肖'=>0, '地肖'=>0],
            'yy' => ['阴肖'=>0, '阳肖'=>0],
            'jx' => ['吉肖'=>0, '凶肖'=>0]
        ];
        
        // 1. 遍历历史数据
        $limitMid = min(count($history), 30);
        for ($i = 0; $i < $limitMid; $i++) {
            $info = ZodiacManager::getInfo($history[$i]['spec']);
            $z = $info['zodiac'];
            
            // 热度加分
            $scores[$z] += ($i < 10) ? $weights['trend_short'] : $weights['trend_mid'];
            
            // 统计属性 (取近20期)
            if ($i < 20) {
                if(isset($info['jy'])) $stats['jy'][$info['jy']]++;
                if(isset($info['td'])) $stats['td'][$info['td']]++;
                if(isset($info['yy'])) $stats['yy'][$info['yy']]++;
                if(isset($info['jx'])) $stats['jx'][$info['jx']]++;
            }
        }

        // 2. 遗漏加分
        foreach ($allZodiacs as $z) {
            $omission = 0;
            foreach ($history as $row) {
                if (ZodiacManager::getInfo($row['spec'])['zodiac'] === $z) break;
                $omission++;
            }
            $scores[$z] += floor($omission / 10) * $weights['omission'];
        }

        // 3. 规律加分 (连庄/三合六合)
        if (isset($history[0])) {
            $lastZ = ZodiacManager::getInfo($history[0]['spec'])['zodiac'];
            $scores[$lastZ] += $weights['repeat'];
            foreach (ZodiacManager::getRelatedZodiacs($lastZ) as $rz) {
                $scores[$rz] += $weights['relation'];
            }
        }
        
        // 4. 平衡理论加分 (Balance Theory)
        // 核心逻辑：如果“阳肖”出太多了，下期“阴肖”概率大，给所有阴肖加分
        foreach ($stats as $type => $counts) {
            asort($counts); // 升序，第一个是弱势方
            $weakest = array_key_first($counts);
            
            // 权重 key 映射: jy -> balance_jy
            $wKey = 'balance_' . $type; 
            
            // 给所有属于弱势方的生肖加分
            foreach ($allZodiacs as $z) {
                $attrs = ZodiacManager::getAttr($z);
                if (isset($attrs[$type]) && $attrs[$type] === $weakest) {
                    $scores[$z] += $weights[$wKey];
                }
            }
        }

        return $scores;
    }

    // AI 回测寻优
    private static function findBestWeights($fullHistory) {
        // 定义策略池 (不同维度的侧重)
        $strategies = [
            '趋势均衡型' => ['trend_short'=>3, 'trend_mid'=>1, 'omission'=>2, 'repeat'=>2, 'relation'=>3, 'balance_jy'=>1, 'balance_td'=>1, 'balance_yy'=>1, 'balance_jx'=>1],
            '冷门回补型' => ['trend_short'=>0.5, 'trend_mid'=>0.5, 'omission'=>4, 'repeat'=>0, 'relation'=>1, 'balance_jy'=>2, 'balance_td'=>2, 'balance_yy'=>2, 'balance_jx'=>2],
            '阴阳风水型' => ['trend_short'=>1, 'trend_mid'=>1, 'omission'=>1, 'repeat'=>1, 'relation'=>1, 'balance_jy'=>0, 'balance_td'=>4, 'balance_yy'=>4, 'balance_jx'=>0], // 侧重天地阴阳
            '吉凶生肖型' => ['trend_short'=>1, 'trend_mid'=>1, 'omission'=>1, 'repeat'=>1, 'relation'=>1, 'balance_jy'=>0, 'balance_td'=>0, 'balance_yy'=>0, 'balance_jx'=>4], // 侧重吉凶
            '三合连庄型' => ['trend_short'=>1, 'trend_mid'=>1, 'omission'=>1, 'repeat'=>3, 'relation'=>5, 'balance_jy'=>0.5, 'balance_td'=>0.5, 'balance_yy'=>0.5, 'balance_jx'=>0.5],
        ];

        $bestStrategy = '趋势均衡型';
        $maxHits = -1;

        $testCount = min(count($fullHistory) - 30, 20); // 回测近20期
        
        foreach ($strategies as $name => $w) {
            $hits = 0;
            for ($i = 0; $i < $testCount; $i++) {
                $mockHistory = array_slice($fullHistory, $i + 1); 
                $actualResult = ZodiacManager::getInfo($fullHistory[$i]['spec'])['zodiac'];
                
                $scores = self::calculateScores($mockHistory, $w);
                arsort($scores);
                $top6 = array_slice(array_keys($scores), 0, 6);
                
                if (in_array($actualResult, $top6)) $hits++;
            }
            if ($hits > $maxHits) {
                $maxHits = $hits;
                $bestStrategy = $name;
            }
        }

        return ['name' => $bestStrategy, 'weights' => $strategies[$bestStrategy]];
    }

    public static function predict($history) {
        if (count($history) < 50) {
            $weights = ['trend_short'=>3, 'trend_mid'=>1, 'omission'=>2, 'repeat'=>2, 'relation'=>3, 'balance_jy'=>1, 'balance_td'=>1, 'balance_yy'=>1, 'balance_jx'=>1];
            $strategyName = "基础型(样本不足)";
        } else {
            $best = self::findBestWeights($history);
            $weights = $best['weights'];
            $strategyName = $best['name'];
        }

        $scores = self::calculateScores($history, $weights);
        arsort($scores);
        $rankedZodiacs = array_keys($scores);

        $sixXiao = array_slice($rankedZodiacs, 0, 6);
        $threeXiao = array_slice($rankedZodiacs, 0, 3);
        
        // 波色推算
        $zodiacMap = ZodiacManager::getMapping();
        $waveScores = ['red'=>0, 'blue'=>0, 'green'=>0];
        foreach ($sixXiao as $z) {
            $nums = $zodiacMap[$z];
            foreach($nums as $n) {
                $c = ZodiacManager::getInfo($n)['color'];
                $waveScores[$c] += $scores[$z]; // 加权波色
            }
        }
        arsort($waveScores);
        $waves = array_keys($waveScores);

        return [
            'six_xiao' => $sixXiao,
            'three_xiao' => $threeXiao,
            'color_wave' => ['primary'=>$waves[0], 'secondary'=>$waves[1]],
            'strategy_used' => $strategyName
        ];
    }
}
?>
<?php
require_once 'ZodiacManager.php';
require_once 'Db.php';

class LotteryLogic {
    
    // ==================================================================
    // 1. 基础工具 & 数据结构
    // ==================================================================
    private static function getFullAttr($num) {
        return ZodiacManager::getInfo($num);
    }

    private static function initScoreBoard() {
        $zodiacMap = ZodiacManager::getMapping();
        return array_fill_keys(array_keys($zodiacMap), 0);
    }

    private static function normalize(&$scores) {
        $max = max($scores);
        if ($max == 0) return;
        foreach ($scores as $k => $v) {
            $scores[$k] = ($v / $max) * 100;
        }
    }

    // ==================================================================
    // 2. 原子算法模型 (Atomic Models)
    // ==================================================================
    
    // M1: 趋势 (Trend) - 短期与中期热度
    private static function m_Trend($history) {
        $scores = self::initScoreBoard();
        $limit = min(count($history), 30);
        for ($i = 0; $i < $limit; $i++) {
            $z = ZodiacManager::getInfo($history[$i]['spec'])['zodiac'];
            // 近10期热度权重更高
            $scores[$z] += ($i < 10 ? 3 : 1);
        }
        self::normalize($scores);
        return $scores;
    }

    // M2: 遗漏 (Omission) - 冷门回补
    private static function m_Omission($history) {
        $scores = self::initScoreBoard();
        foreach (array_keys($scores) as $z) {
            $cnt = 0;
            foreach ($history as $row) {
                if (ZodiacManager::getInfo($row['spec'])['zodiac'] == $z) break;
                $cnt++;
            }
            // 遗漏越久，分越高 (每10期加10分)
            $scores[$z] += floor($cnt / 10) * 10;
        }
        self::normalize($scores);
        return $scores;
    }

    // M3: 生肖链 (Link) - 三合六合
    private static function m_Link($history) {
        $scores = self::initScoreBoard();
        if ($history) {
            $lastZ = ZodiacManager::getInfo($history[0]['spec'])['zodiac'];
            $related = ZodiacManager::getRelatedZodiacs($lastZ);
            foreach ($related as $rz) $scores[$rz] += 10;
        }
        self::normalize($scores);
        return $scores;
    }

    // M4: 尾数 (Tail) - 尾数走势映射
    private static function m_Tail($history) {
        $scores = self::initScoreBoard();
        $tailCounts = array_fill(0, 10, 0);
        for ($i = 0; $i < min(count($history), 10); $i++) {
            $tailCounts[intval($history[$i]['spec']) % 10]++;
        }
        arsort($tailCounts);
        $hotTails = array_slice(array_keys($tailCounts), 0, 3);
        
        $map = ZodiacManager::getMapping();
        foreach ($scores as $z => $v) {
            foreach ($map[$z] as $n) {
                if (in_array($n % 10, $hotTails)) $scores[$z] += 10;
            }
        }
        self::normalize($scores);
        return $scores;
    }

    // M5: 五行 (WuXing) - 五行相生
    private static function m_WuXing($history) {
        $scores = self::initScoreBoard();
        if ($history) {
            $lastElem = ZodiacManager::getInfo($history[0]['spec'])['element'];
            // 金生水, 水生木, 木生火, 火生土, 土生金
            $genMap = ['金'=>'水', '水'=>'木', '木'=>'火', '火'=>'土', '土'=>'金'];
            $target = $genMap[$lastElem] ?? '';
            
            $map = ZodiacManager::getMapping();
            foreach ($scores as $z => $v) {
                foreach ($map[$z] as $n) {
                    if (ZodiacManager::getInfo($n)['element'] == $target) {
                        $scores[$z] += 10;
                        break;
                    }
                }
            }
        }
        self::normalize($scores);
        return $scores;
    }

    // M6: 历史回溯 (History) - 寻找历史镜像
    private static function m_History($history) {
        $scores = self::initScoreBoard();
        if (count($history) < 20) return $scores;
        
        $current = self::getFullAttr($history[0]['spec']);
        
        // 从第2条开始往回找 (跳过刚刚开的那期)
        for ($i = 2; $i < count($history); $i++) {
            $past = self::getFullAttr($history[$i]['spec']);
            $sim = 0;
            if ($current['zodiac'] == $past['zodiac']) $sim += 30;
            if ($current['color'] == $past['color']) $sim += 20;
            
            // 如果相似度高，看它的下一期($i-1)开了啥
            if ($sim >= 50) {
                $nextZ = ZodiacManager::getInfo($history[$i-1]['spec'])['zodiac'];
                $scores[$nextZ] += $sim;
            }
        }
        self::normalize($scores);
        return $scores;
    }

    // ==================================================================
    // 3. 遗传算法引擎 (Darwin Engine) - 优化版
    // ==================================================================

    private static function createGene() {
        return [
            'w_trend' => rand(0, 100) / 10,
            'w_omiss' => rand(0, 100) / 10,
            'w_link'  => rand(0, 100) / 10,
            'w_tail'  => rand(0, 100) / 10,
            'w_wuxing'=> rand(0, 100) / 10,
            'w_hist'  => rand(0, 100) / 10,
            'fitness' => 0
        ];
    }

    // 使用指定的基因(权重)跑一次预测
    private static function runPrediction($history, $gene) {
        $final = self::initScoreBoard();
        
        // 计算各模型得分
        $m1 = self::m_Trend($history);
        $m2 = self::m_Omission($history);
        $m3 = self::m_Link($history);
        $m4 = self::m_Tail($history);
        $m5 = self::m_WuXing($history);
        $m6 = self::m_History($history);

        // 加权汇总
        foreach ($final as $z => $s) {
            $final[$z] += $m1[$z] * $gene['w_trend'];
            $final[$z] += $m2[$z] * $gene['w_omiss'];
            $final[$z] += $m3[$z] * $gene['w_link'];
            $final[$z] += $m4[$z] * $gene['w_tail'];
            $final[$z] += $m5[$z] * $gene['w_wuxing'];
            $final[$z] += $m6[$z] * $gene['w_hist'];
        }
        
        // 排序返回
        arsort($final);
        return array_keys($final);
    }

    // 进化过程
    private static function evolve($fullHistory) {
        // 参数优化：降低计算量以适配 Serv00
        $POPULATION_SIZE = 20; 
        $GENERATIONS = 5;      
        $TEST_RANGE = 10;      

        // 初始种群
        $population = [];
        for ($i=0; $i<$POPULATION_SIZE; $i++) $population[] = self::createGene();

        // 迭代
        for ($g=0; $g<$GENERATIONS; $g++) {
            // 计算适应度
            foreach ($population as &$gene) {
                $score = 0;
                for ($t=0; $t<$TEST_RANGE; $t++) {
                    // 模拟切片
                    $mockHistory = array_slice($fullHistory, $t + 1); 
                    if (count($mockHistory) < 50) break; // 数据太少跳过
                    
                    $realResult = ZodiacManager::getInfo($fullHistory[$t]['spec'])['zodiac'];
                    $ranking = self::runPrediction($mockHistory, $gene);
                    
                    $top6 = array_slice($ranking, 0, 6);
                    $top3 = array_slice($ranking, 0, 3);

                    if (in_array($realResult, $top6)) $score += 10;
                    if (in_array($realResult, $top3)) $score += 30;
                }
                $gene['fitness'] = $score;
            }
            unset($gene);

            // 排序
            usort($population, function($a, $b) { return $b['fitness'] - $a['fitness']; });
            if ($g == $GENERATIONS - 1) break;

            // 繁衍
            $eliteCount = intval($POPULATION_SIZE / 2);
            $newPop = array_slice($population, 0, $eliteCount);
            while (count($newPop) < $POPULATION_SIZE) {
                $p1 = $population[rand(0, $eliteCount-1)];
                $p2 = $population[rand(0, $eliteCount-1)];
                
                $child = [
                    'w_trend' => ($p1['w_trend']+$p2['w_trend'])/2,
                    'w_omiss' => ($p1['w_omiss']+$p2['w_omiss'])/2,
                    'w_link'  => ($p1['w_link'] +$p2['w_link']) /2,
                    'w_tail'  => ($p1['w_tail'] +$p2['w_tail']) /2,
                    'w_wuxing'=> ($p1['w_wuxing']+$p2['w_wuxing'])/2,
                    'w_hist'  => ($p1['w_hist'] +$p2['w_hist']) /2,
                    'fitness' => 0
                ];
                
                // 变异
                if (rand(0,100) < 10) {
                    $keys = ['w_trend','w_omiss','w_link','w_tail','w_wuxing','w_hist'];
                    $k = $keys[array_rand($keys)];
                    $child[$k] = rand(0, 100) / 10;
                }
                $newPop[] = $child;
            }
            $population = $newPop;
        }
        return $population[0];
    }

    // --- 辅助预测：大小单双 ---
    private static function predict_BS_OE($history) {
        $bsCount = ['大'=>0, '小'=>0];
        $oeCount = ['单'=>0, '双'=>0];
        // 简单统计近20期
        for($i=0; $i<min(count($history),20); $i++) {
            $info = ZodiacManager::getInfo($history[$i]['spec']);
            $bsCount[$info['bs']]++;
            $oeCount[$info['oe']]++;
        }
        // 概率平衡策略：如果大出多了，就推小
        asort($bsCount); $bs = array_key_first($bsCount);
        asort($oeCount); $oe = array_key_first($oeCount);
        return ['bs'=>$bs, 'oe'=>$oe];
    }

    // ==================================================================
    // 4. 公共接口
    // ==================================================================
    
    public static function predict($history) {
        // 1. 启动进化
        $bestGene = self::evolve($history);
        
        // 2. 预测
        $ranking = self::runPrediction($history, $bestGene);
        $sixXiao = array_slice($ranking, 0, 6);
        $threeXiao = array_slice($ranking, 0, 3);
        
        // 3. 波色 (基于三肖)
        $zodiacMap = ZodiacManager::getMapping();
        $waveStats = ['red'=>0, 'blue'=>0, 'green'=>0];
        foreach ($threeXiao as $z) {
            foreach ($zodiacMap[$z] as $n) {
                $info = ZodiacManager::getInfo($n);
                $w = ($info['element']=='金'||$info['element']=='水') ? 1.5 : 1;
                $waveStats[$info['color']] += $w;
            }
        }
        arsort($waveStats);
        $waves = array_keys($waveStats);
        
        // 4. 其它
        $bsoe = self::predict_BS_OE($history);
        $killed = end($ranking);

        return [
            'six_xiao' => $sixXiao,
            'three_xiao' => $threeXiao,
            'color_wave' => ['primary'=>$waves[0], 'secondary'=>$waves[1]],
            'bs' => $bsoe['bs'],
            'oe' => $bsoe['oe'],
            'strategy_used' => "V8进化(F:{$bestGene['fitness']}) | 杀:{$killed}"
        ];
    }

    // 复盘逻辑
    public static function verifyPrediction($issue, $specNum) {
        $pdo = Db::connect();
        $stmt = $pdo->prepare("SELECT * FROM prediction_history WHERE issue = ?");
        $stmt->execute([$issue]);
        $record = $stmt->fetch();
        if (!$record) return;

        $info = ZodiacManager::getInfo($specNum);
        $realZodiac = $info['zodiac'];
        $realColor = $info['color'];

        $sixArr = explode(',', $record['six_xiao']);
        $threeArr = explode(',', $record['three_xiao']);
        
        $isHitSix = in_array($realZodiac, $sixArr) ? 1 : 0;
        $isHitThree = in_array($realZodiac, $threeArr) ? 1 : 0;
        $isHitWave = ($realColor == $record['wave_primary'] || $realColor == $record['wave_secondary']) ? 1 : 0;

        $upd = $pdo->prepare("UPDATE prediction_history SET result_zodiac=?, is_hit_six=?, is_hit_three=?, is_hit_wave=? WHERE issue=?");
        $upd->execute([$realZodiac, $isHitSix, $isHitThree, $isHitWave, $issue]);

        if ($isHitSix == 0) {
            $log = $pdo->prepare("INSERT INTO learning_logs (issue, error_reason) VALUES (?, ?)");
            $log->execute([$issue, "预测失误:实际{$realZodiac}"]);
        }
    }
}
?>

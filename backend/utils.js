/**
 * 六合宝典核心算法库 (V11.5 Pro - Node.js 移植版)
 * 完美复刻原 Cloudflare Worker 文档中的所有高级统计与预测逻辑
 * 包含：生肖转移矩阵、波色转移、尾数关联、热度、遗漏、形态分析
 */
const { Lunar } = require('lunar-javascript');

// ==========================================
// 1. 全局常量配置 (CONFIG)
// ==========================================
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"]; // 2025年顺序

// 生肖包含的号码映射
const ZODIAC_MAP = {
    "鼠": [6, 18, 30, 42],
    "牛": [5, 17, 29, 41],
    "虎": [4, 16, 28, 40],
    "兔": [3, 15, 27, 39],
    "龙": [2, 14, 26, 38],
    "蛇": [1, 13, 25, 37, 49],
    "马": [12, 24, 36, 48],
    "羊": [11, 23, 35, 47],
    "猴": [10, 22, 34, 46],
    "鸡": [9, 21, 33, 45],
    "狗": [8, 20, 32, 44],
    "猪": [7, 19, 31, 43]
};

const COLORS = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// 算法权重 (复刻自文档)
const ALGO_WEIGHTS = {
    w_zodiac_transfer: 3.0,
    w_color_transfer: 2.0,
    w_tail_correlation: 1.8,
    w_number_frequency: 1.5,
    w_omission_value: 1.2,
    w_shape_pattern: 1.0
};

// ==========================================
// 2. 辅助工具函数 (Formatter)
// ==========================================

function getShengXiao(num) { 
    return ZODIAC_SEQ[(num - 1) % 12]; 
}

// 获取号码详细属性
function getAttributes(num) {
    num = parseInt(num);
    let color = 'red';
    if (COLORS.blue.includes(num)) color = 'blue';
    else if (COLORS.green.includes(num)) color = 'green';

    let zodiac = '';
    for (const [z, nums] of Object.entries(ZODIAC_MAP)) {
        if (nums.includes(num)) {
            zodiac = z;
            break;
        }
    }
    // 兜底
    if (!zodiac) zodiac = getShengXiao(num);
    
    return { zodiac, color };
}

// 文本解析辅助
function normalizeZodiac(char) {
    const map = { '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊' };
    return map[char] || char;
}

// ==========================================
// 3. 高级统计引擎 (AdvancedStatsEngine)
// ==========================================

// 分析历史数据，构建统计模型
function analyzeHistoryStatistics(history) {
    const stats = {
        zodiacTransfer: {}, // 生肖转移矩阵
        colorTransfer: {},  // 波色转移矩阵
        tailCorrelation: {}, // 尾数关联矩阵
        specialFrequency: {}, // 特码频率
        normalFrequency: {},  // 平码频率
        omissionStats: {},    // 生肖遗漏
        totalRecords: history.length,
        shapeStats: { bigOdd: 0, bigEven: 0, smallOdd: 0, smallEven: 0 }
    };

    // 初始化结构
    Object.keys(ZODIAC_MAP).forEach(z1 => {
        stats.zodiacTransfer[z1] = {};
        stats.omissionStats[z1] = 0;
        Object.keys(ZODIAC_MAP).forEach(z2 => stats.zodiacTransfer[z1][z2] = 0);
    });
    
    ['red','blue','green'].forEach(c1 => {
        stats.colorTransfer[c1] = { red:0, blue:0, green:0 };
    });
    
    for(let i=0; i<10; i++) {
        stats.tailCorrelation[i] = {};
        for(let j=0; j<10; j++) stats.tailCorrelation[i][j] = 0;
    }
    
    for(let i=1; i<=49; i++) {
        stats.specialFrequency[i] = 0;
        stats.normalFrequency[i] = 0;
    }

    // 遍历历史 (注意：history 通常是 [最新, 次新...])
    // 我们需要的是 [旧 -> 新] 的转移关系，所以从后往前遍历，或者 i+1 -> i
    for (let i = 0; i < history.length - 1; i++) {
        const current = history[i]; // 本期 (新)
        const prev = history[i+1];  // 上期 (旧)
        
        const curSpec = parseInt(current.special_code);
        const prevSpec = parseInt(prev.special_code);
        
        const curAttr = getAttributes(curSpec);
        const prevAttr = getAttributes(prevSpec);

        // 1. 生肖转移
        if (stats.zodiacTransfer[prevAttr.zodiac]) {
            stats.zodiacTransfer[prevAttr.zodiac][curAttr.zodiac]++;
        }
        
        // 2. 波色转移
        if (stats.colorTransfer[prevAttr.color]) {
            stats.colorTransfer[prevAttr.color][curAttr.color]++;
        }
        
        // 3. 尾数关联
        const prevTail = prevSpec % 10;
        const curTail = curSpec % 10;
        stats.tailCorrelation[prevTail][curTail]++;

        // 4. 频率统计
        stats.specialFrequency[curSpec]++;
        
        // 5. 形态统计
        const isBig = curSpec >= 25;
        const isOdd = curSpec % 2 !== 0;
        if (isBig && isOdd) stats.shapeStats.bigOdd++;
        else if (isBig && !isOdd) stats.shapeStats.bigEven++;
        else if (!isBig && isOdd) stats.shapeStats.smallOdd++;
        else stats.shapeStats.smallEven++;

        // 6. 平码统计 (如果数据包含平码)
        if (current.numbers) {
            try {
                const nums = typeof current.numbers === 'string' ? JSON.parse(current.numbers) : current.numbers;
                nums.forEach(n => stats.normalFrequency[n]++);
            } catch(e) {}
        }
    }

    // 计算遗漏值 (最近多少期没开)
    const currentOmission = {};
    Object.keys(ZODIAC_MAP).forEach(z => currentOmission[z] = 0);
    
    // 从最新往旧遍历
    for(let i = 0; i < history.length; i++) {
        const spec = parseInt(history[i].special_code);
        const zodiac = getAttributes(spec).zodiac;
        
        Object.keys(currentOmission).forEach(z => {
            if (currentOmission[z] !== -1) {
                if (z === zodiac) currentOmission[z] = -1; // 遇到了，停止计数
                else currentOmission[z]++;
            }
        });
    }
    // 修正 -1 为 0
    Object.keys(currentOmission).forEach(z => {
        if(currentOmission[z] === -1) currentOmission[z] = 0;
    });
    stats.omissionStats = currentOmission;

    // 归一化 (Normalize)
    // 生肖转移概率化
    Object.keys(stats.zodiacTransfer).forEach(z1 => {
        const total = Object.values(stats.zodiacTransfer[z1]).reduce((a,b)=>a+b, 0);
        if(total > 0) {
            Object.keys(stats.zodiacTransfer[z1]).forEach(z2 => {
                stats.zodiacTransfer[z1][z2] /= total;
            });
        }
    });

    return stats;
}

// 根据统计生成所有号码的评分
function generatePredictionScores(lastSpecial, stats) {
    const scores = {};
    const lastAttr = getAttributes(lastSpecial);
    const lastTail = lastSpecial % 10;

    for (let num = 1; num <= 49; num++) {
        const attr = getAttributes(num);
        const tail = num % 10;
        let score = 0;

        // 1. 生肖转移分
        const zProb = stats.zodiacTransfer[lastAttr.zodiac]?.[attr.zodiac] || 0;
        score += zProb * 100 * ALGO_WEIGHTS.w_zodiac_transfer;

        // 2. 波色转移分
        const cProb = stats.colorTransfer[lastAttr.color]?.[attr.color] || 0;
        score += cProb * 80 * ALGO_WEIGHTS.w_color_transfer;

        // 3. 尾数关联分
        const tProb = stats.tailCorrelation[lastTail]?.[tail] || 0;
        score += tProb * 60 * ALGO_WEIGHTS.w_tail_correlation;

        // 4. 热度分
        const freq = stats.specialFrequency[num] || 0;
        score += freq * 40 * ALGO_WEIGHTS.w_number_frequency;

        // 5. 遗漏分 (追冷/防冷逻辑)
        const om = stats.omissionStats[attr.zodiac] || 0;
        if (om > 20) score += 50 * ALGO_WEIGHTS.w_omission_value;
        else if (om > 10) score += 30 * ALGO_WEIGHTS.w_omission_value;
        else if (om === 0) score -= 20; // 刚开过减分

        // 6. 形态分
        const isBig = num >= 25;
        const isOdd = num % 2 !== 0;
        const shapeType = isBig ? (isOdd ? "bigOdd" : "bigEven") : (isOdd ? "smallOdd" : "smallEven");
        const shapeProb = (stats.shapeStats[shapeType] || 0) / Math.max(1, stats.totalRecords);
        score += shapeProb * 25 * ALGO_WEIGHTS.w_shape_pattern;

        // 7. 随机扰动 (0-10分)
        score += Math.random() * 10;

        scores[num] = score;
    }
    return scores;
}

// ==========================================
// 4. 预测生成主入口 (Generate)
// ==========================================
function generateSinglePrediction(historyRows) {
    // 兜底数据 (如果历史为空)
    if (!historyRows || historyRows.length < 5) {
        // 生成模拟数据
        historyRows = Array(50).fill(0).map((_,i) => ({ 
            special_code: Math.floor(Math.random()*49)+1, 
            issue: 2024000-i,
            numbers: [1,2,3,4,5,6] 
        }));
    }

    const lastDraw = historyRows[0];
    const lastSpecial = parseInt(lastDraw.special_code);

    // 1. 运行统计引擎
    const stats = analyzeHistoryStatistics(historyRows);
    
    // 2. 计算全码评分
    const scores = generatePredictionScores(lastSpecial, stats);

    // 3. [核心] 生成一肖一码 (Zodiac Best Numbers)
    const zodiacBestNumbers = [];
    Object.keys(ZODIAC_MAP).forEach(z => {
        const nums = ZODIAC_MAP[z];
        let bestNum = nums[0];
        let maxScore = -999999;
        
        nums.forEach(n => {
            if (scores[n] > maxScore) {
                maxScore = scores[n];
                bestNum = n;
            }
        });
        zodiacBestNumbers.push({ 
            zodiac: z, 
            num: bestNum, 
            color: getAttributes(bestNum).color 
        });
    });

    // 4. [核心] 生成特码前五 (Special Top 5)
    // 将所有号码按分数排序
    const allNumsSorted = Object.keys(scores)
        .map(n => ({ num: parseInt(n), score: scores[n] }))
        .sort((a,b) => b.score - a.score);
    
    const specialTop5 = allNumsSorted.slice(0, 5).map(i => ({
        num: i.num,
        zodiac: getAttributes(i.num).zodiac,
        color: getAttributes(i.num).color,
        score: i.score
    }));

    // 5. [核心] 生成精选平码 (Normal Top 6)
    // 逻辑：排除特码前5后，分数最高的6个
    const excludeSet = new Set(specialTop5.map(i => i.num));
    const normalTop6 = allNumsSorted
        .filter(i => !excludeSet.has(i.num))
        .slice(0, 6)
        .map(i => ({
            num: i.num,
            zodiac: getAttributes(i.num).zodiac,
            color: getAttributes(i.num).color
        }));

    // 6. 生成常规预测 (五肖/波色/尾数)
    
    // 计算生肖平均分
    const zodiacAvgScores = {};
    Object.keys(ZODIAC_MAP).forEach(z => {
        const nums = ZODIAC_MAP[z];
        let total = 0;
        nums.forEach(n => total += scores[n]);
        zodiacAvgScores[z] = total / nums.length;
    });
    const sortedZodiacs = Object.keys(zodiacAvgScores).sort((a,b) => zodiacAvgScores[b] - zodiacAvgScores[a]);
    
    // 杀肖：最后3名
    const killZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

    // 波色
    const colorScores = {red:0, blue:0, green:0};
    ['red','blue','green'].forEach(c => {
        COLORS[c].forEach(n => colorScores[c] += scores[n]);
        colorScores[c] /= COLORS[c].length; // 平均分
    });
    const sortedColors = Object.keys(colorScores).sort((a,b) => colorScores[b] - colorScores[a]);

    // 尾数
    const tailScores = {};
    for(let t=0; t<10; t++) tailScores[t] = 0;
    for(let n=1; n<=49; n++) tailScores[n%10] += scores[n];
    const sortedTails = Object.keys(tailScores)
        .sort((a,b) => tailScores[b] - tailScores[a])
        .slice(0, 5) // 前5个尾数
        .map(Number)
        .sort((a,b)=>a-b);

    // 头数
    const bestNum = specialTop5[0].num;
    const hotHead = Math.floor(bestNum / 10);
    // 防头：第二名特码的头
    const fangHead = Math.floor(specialTop5[1].num / 10);

    // 形态
    const isBig = bestNum >= 25;
    const isOdd = bestNum % 2 !== 0;
    const shape = (isBig ? "大" : "小") + (isOdd ? "单" : "双");

    return {
        // 新版结构
        zodiac_one_code: zodiacBestNumbers,
        special_numbers: specialTop5,
        normal_numbers: normalTop6,
        
        // 兼容旧版字段
        liu_xiao: sortedZodiacs.slice(0, 5),
        zhu_san: sortedZodiacs.slice(0, 3),
        kill_zodiacs: killZodiacs,
        zhu_bo: sortedColors[0],
        fang_bo: sortedColors[1],
        hot_head: hotHead,
        fang_head: fangHead,
        rec_tails: sortedTails,
        da_xiao: isBig ? "大" : "小",
        dan_shuang: isOdd ? "单" : "双",
        shape: shape
    };
}

// 文本解析函数 (兼容)
function parseLotteryResult(text) {
    try {
        const issueMatch = text.match(/第:?(\d+)期/);
        if (!issueMatch) return null;
        const issue = issueMatch[1];
        const lines = text.split('\n');
        let numbersLine = '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (/^(\d{2}\s+){6}\d{2}$/.test(trimmed) || (trimmed.match(/\d{2}/g) || []).length === 7) {
                numbersLine = trimmed; break;
            }
        }
        if (!numbersLine) return null;
        const allNums = numbersLine.match(/\d{2}/g).map(Number);
        if (allNums.length !== 7) return null;
        const flatNumbers = allNums.slice(0, 6);
        const specialCode = allNums[6];
        let shengxiao = getAttributes(specialCode).zodiac;
        
        // 尝试从文本获取更准确的生肖
        for (const line of lines) {
            if (/[鼠牛虎兔龍龙蛇馬马羊猴雞鸡狗豬猪]/.test(line)) {
                const animals = line.trim().split(/\s+/);
                if (animals.length >= 7) { 
                    shengxiao = normalizeZodiac(animals[6]); 
                }
            }
        }
        return { issue, flatNumbers, specialCode, shengxiao };
    } catch (e) { console.error("解析出错:", e); return null; }
}

// 评分函数 (用于Bot后台迭代优化)
function scorePrediction(pred, historyRows) {
    // 简单的迭代评分逻辑
    // 如果特码前五里包含了近期热码，加分
    let score = 0;
    const hotNums = historyRows.slice(0, 10).map(r => parseInt(r.special_code));
    pred.special_numbers.forEach(item => {
        if (hotNums.includes(item.num)) score += 10;
    });
    return score + Math.random() * 20;
}

module.exports = { parseLotteryResult, generateSinglePrediction, scorePrediction };

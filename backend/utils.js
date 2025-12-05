/**
 * 澳门六合彩预测机器人核心算法库
 * 版本: V5.5 Pro Edition (Node.js 移植版)
 */

// ==============================================================================
// 1. 全局配置与常量定义
// ==============================================================================
const CONFIG = {
    DEFAULT_ALGO_WEIGHTS: {
        w_zodiac_transfer: 3.0,
        w_zodiac_relation: 2.5,
        w_color_transfer: 2.0,
        w_tail_correlation: 1.8,
        w_number_frequency: 1.5,
        w_omission_value: 1.2,
        w_shape_pattern: 1.0,
        w_head_tail: 0.8,
        w_normal_correlation: 2.0,
    },
    ZODIAC_MAP: {
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
    },
    ZODIAC_RELATIONS: {
        SIX_HARMONY: { "鼠": "牛", "牛": "鼠", "虎": "猪", "猪": "虎", "兔": "狗", "狗": "兔", "龙": "鸡", "鸡": "龙", "蛇": "猴", "猴": "蛇", "马": "羊", "羊": "马" },
        THREE_HARMONY: { "鼠": ["龙", "猴"], "牛": ["蛇", "鸡"], "虎": ["马", "狗"], "兔": ["羊", "猪"], "龙": ["鼠", "猴"], "蛇": ["牛", "鸡"], "马": ["虎", "狗"], "羊": ["兔", "猪"], "猴": ["鼠", "龙"], "鸡": ["牛", "蛇"], "狗": ["虎", "马"], "猪": ["兔", "羊"] },
        OPPOSITION: { "鼠": "马", "马": "鼠", "牛": "羊", "羊": "牛", "虎": "猴", "猴": "虎", "兔": "鸡", "鸡": "兔", "龙": "狗", "狗": "龙", "蛇": "猪", "猪": "蛇" }
    },
    COLORS: {
        red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
        blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
        green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
    }
};

// ==============================================================================
// 2. 格式化工具
// ==============================================================================
class Formatter {
    static getAttributes(number) {
        const num = parseInt(number);
        if (num < 1 || num > 49) return { zodiac: "未知", color: "未知" };
        
        let color = "red";
        if (CONFIG.COLORS.blue.includes(num)) color = "blue";
        else if (CONFIG.COLORS.green.includes(num)) color = "green";
        
        let zodiac = "";
        for (const [zodiacName, numbers] of Object.entries(CONFIG.ZODIAC_MAP)) {
            if (numbers.includes(num)) { zodiac = zodiacName; break; }
        }
        return { zodiac, color };
    }
}

// ==============================================================================
// 3. 高级统计引擎 (AdvancedStatsEngine) - 移植
// ==============================================================================
class AdvancedStatsEngine {
    static analyzeHistoryStatistics(history) {
        // 初始化空统计
        const stats = {
            totalRecords: history.length,
            zodiacTransfer: {}, colorTransfer: { red: {}, blue: {}, green: {} }, tailCorrelation: {},
            zodiacRelations: { sixHarmony: {}, threeHarmony: {}, opposition: {} },
            specialFrequency: {}, normalFrequency: {},
            normalCombination: { zodiacPairs: {}, colorDistribution: {}, tailDistribution: {} },
            omissionStats: {}, shapeStats: { bigOdd: 0, bigEven: 0, smallOdd: 0, smallEven: 0 }
        };
        // 初始化结构
        Object.keys(CONFIG.ZODIAC_MAP).forEach(z => {
            stats.zodiacTransfer[z] = {};
            stats.zodiacRelations.sixHarmony[z] = 0; stats.zodiacRelations.threeHarmony[z] = 0; stats.zodiacRelations.opposition[z] = 0;
            Object.keys(CONFIG.ZODIAC_MAP).forEach(z2 => stats.zodiacTransfer[z][z2] = 0);
            stats.omissionStats[z] = 0;
        });
        ['red','blue','green'].forEach(c => {
            ['red','blue','green'].forEach(c2 => stats.colorTransfer[c][c2] = 0);
            stats.normalCombination.colorDistribution[c] = { count: 0, probability: 0 };
        });
        for(let i=0; i<10; i++) {
            stats.tailCorrelation[i] = {}; for(let j=0; j<10; j++) stats.tailCorrelation[i][j] = 0;
            stats.normalCombination.tailDistribution[i] = { count: 0, probability: 0 };
        }
        for(let i=1; i<=49; i++) { stats.specialFrequency[i]=0; stats.normalFrequency[i]=0; }

        if (history.length < 2) return stats;

        // 遍历历史计算
        for (let i = 0; i < history.length - 1; i++) {
            const curr = history[i]; // MySQL desc 顺序，i是较新，i+1是较旧。
            // 注意：V5.5 源码假设 history[i] 是当前，history[i+1] 是下一期（未来）。
            // 但通常 DB 取出是 DESC (最新在0)。所以这里我们倒过来理解：
            // 我们要分析的是：已知 i+1 期(旧)，它如何影响 i 期(新)。
            
            const prevRow = history[i+1];
            const currRow = history[i]; // 这是相对于 prevRow 的“下一期”

            const prevSp = prevRow.special_code;
            const currSp = currRow.special_code;
            const currNormals = currRow.numbers; // 假设传入已解析的数组

            const prevAttr = Formatter.getAttributes(prevSp);
            const currAttr = Formatter.getAttributes(currSp);

            // 1. 生肖转移
            if(stats.zodiacTransfer[prevAttr.zodiac]) stats.zodiacTransfer[prevAttr.zodiac][currAttr.zodiac]++;
            // 2. 波色转移
            if(stats.colorTransfer[prevAttr.color]) stats.colorTransfer[prevAttr.color][currAttr.color]++;
            // 3. 尾数
            // 这里简化逻辑：上期特码尾数 -> 本期特码尾数
            stats.tailCorrelation[prevSp%10][currSp%10]++;

            // 4. 频率
            stats.specialFrequency[currSp]++;
            currNormals.forEach(n => stats.normalFrequency[n]++);

            // 5. 遗漏 (简单计算：倒序遍历统计未出现次数)
            // 在循环外单独算更准，这里略过
        }

        // 遗漏计算 (从最新往回数)
        for(let i=0; i<history.length; i++) {
            const sp = history[i].special_code;
            const z = Formatter.getAttributes(sp).zodiac;
            Object.keys(stats.omissionStats).forEach(key => {
                if(stats.omissionStats[key] !== -1) {
                    if(key === z) stats.omissionStats[key] = -1; // 出现了，标记结束
                    else stats.omissionStats[key]++;
                }
            });
        }
        // 修正-1
        Object.keys(stats.omissionStats).forEach(k => { if(stats.omissionStats[k]===-1) stats.omissionStats[k]=0; });

        return stats;
    }

    static generatePredictionScores(lastSpecial, stats, weights) {
        const scores = {};
        const lastAttr = Formatter.getAttributes(lastSpecial);
        
        for (let num = 1; num <= 49; num++) {
            const attr = Formatter.getAttributes(num);
            let score = 0;
            
            // 转移矩阵加权
            const zTransfer = stats.zodiacTransfer[lastAttr.zodiac]?.[attr.zodiac] || 0;
            score += zTransfer * 10 * weights.w_zodiac_transfer;

            const cTransfer = stats.colorTransfer[lastAttr.color]?.[attr.color] || 0;
            score += cTransfer * 8 * weights.w_color_transfer;

            // 尾数
            const tTransfer = stats.tailCorrelation[lastSpecial%10]?.[num%10] || 0;
            score += tTransfer * 6 * weights.w_tail_correlation;

            // 频率
            score += (stats.specialFrequency[num] || 0) * 4 * weights.w_number_frequency;

            // 遗漏加权 (追热杀冷策略)
            const omi = stats.omissionStats[attr.zodiac] || 0;
            if(omi > 10 && omi < 20) score += 30 * weights.w_omission_value; // 蓄势待发
            if(omi > 30) score -= 20 * weights.w_omission_value; // 极冷不碰

            // 生肖关系
            if (CONFIG.ZODIAC_RELATIONS.SIX_HARMONY[lastAttr.zodiac] === attr.zodiac) score += 20 * weights.w_zodiac_relation;
            
            scores[num] = score + Math.random() * 5; // 随机扰动
        }
        return scores;
    }
}

// ==============================================================================
// 4. 预测生成引擎 (AdvancedPredictionEngine) - 移植
// ==============================================================================
class AdvancedPredictionEngine {
    static generate(historyRows, nextIssue) {
        const weights = CONFIG.DEFAULT_ALGO_WEIGHTS;
        
        // 1. 数据准备
        if (!historyRows || historyRows.length < 10) {
            // 回退到静态随机 (Fallback)
            return this.generateStaticFallback(nextIssue);
        }

        const lastRow = historyRows[0];
        const lastSpecial = lastRow.special_code;
        const stats = AdvancedStatsEngine.analyzeHistoryStatistics(historyRows);
        const scores = AdvancedStatsEngine.generatePredictionScores(lastSpecial, stats, weights);

        // 2. 提取特码推荐 (前5)
        const sortedNums = Object.keys(scores).map(n=>parseInt(n)).sort((a,b) => scores[b] - scores[a]);
        const specialNumbers = sortedNums.slice(0, 5).map(n => ({
            number: n,
            ...Formatter.getAttributes(n),
            score: scores[n]
        }));

        // 3. 提取平码推荐 (去除特码后的高分)
        const normalNumbers = sortedNums.slice(5, 11).map(n => ({
            number: n,
            ...Formatter.getAttributes(n)
        }));

        // 4. 生肖/波色/尾数 统计
        const zodiacScores = {};
        const colorScores = {};
        const tailScores = {};
        
        sortedNums.forEach(n => {
            const attr = Formatter.getAttributes(n);
            const s = scores[n];
            
            zodiacScores[attr.zodiac] = (zodiacScores[attr.zodiac] || 0) + s;
            colorScores[attr.color] = (colorScores[attr.color] || 0) + s;
            tailScores[n%10] = (tailScores[n%10] || 0) + s;
        });

        // 5. 排序属性
        const sortedZodiacs = Object.keys(zodiacScores).sort((a,b) => zodiacScores[b] - zodiacScores[a]);
        const sortedColors = Object.keys(colorScores).sort((a,b) => colorScores[b] - colorScores[a]);
        const sortedTails = Object.keys(tailScores).sort((a,b) => tailScores[b] - tailScores[a]).slice(0, 5).map(Number).sort((a,b)=>a-b);

        // 6. [核心新功能] 一肖一码
        const zodiacBestNumbers = {};
        Object.keys(CONFIG.ZODIAC_MAP).forEach(zodiac => {
            const numbers = CONFIG.ZODIAC_MAP[zodiac];
            let bestNum = numbers[0];
            let maxS = -99999;
            numbers.forEach(n => {
                if(scores[n] > maxS) { maxS = scores[n]; bestNum = n; }
            });
            zodiacBestNumbers[zodiac] = {
                number: bestNum,
                ...Formatter.getAttributes(bestNum)
            };
        });

        // 7. 头数/形态
        const bestNum = specialNumbers[0].number;
        const head = Math.floor(bestNum / 10);
        const isBig = bestNum >= 25;
        const isOdd = bestNum % 2 !== 0;
        const shape = (isBig ? "大" : "小") + (isOdd ? "单" : "双");

        return {
            nextExpect: nextIssue,
            zodiac: { main: sortedZodiacs.slice(0,3), guard: sortedZodiacs.slice(3,5) },
            color: { main: sortedColors[0], guard: sortedColors[1] },
            tail: sortedTails,
            head: `${head}头`,
            shape: shape,
            specialNumbers: specialNumbers,
            normalNumbers: normalNumbers,
            zodiacBestNumbers: zodiacBestNumbers, // V5.5 核心数据
            confidence: 88,
            algorithmVersion: "V5.5 Pro"
        };
    }

    static generateStaticFallback(issue) {
        // 简化的随机生成，防报错
        const zList = Object.keys(CONFIG.ZODIAC_MAP);
        const zBest = {};
        zList.forEach(z => {
            const nums = CONFIG.ZODIAC_MAP[z];
            const n = nums[Math.floor(Math.random()*nums.length)];
            zBest[z] = { number: n, ...Formatter.getAttributes(n) };
        });
        return {
            nextExpect: issue,
            zodiac: { main: ['龙','马','猴'], guard: ['鼠','猪'] },
            color: { main: 'red', guard: 'blue' },
            tail: [1,3,5,7,9],
            head: '0头',
            shape: '大单',
            specialNumbers: [1,13,25,37,49].map(n=>({number:n, ...Formatter.getAttributes(n)})),
            normalNumbers: [2,14,26,38,3,15].map(n=>({number:n, ...Formatter.getAttributes(n)})),
            zodiacBestNumbers: zBest,
            confidence: 50,
            algorithmVersion: "V5.5 Static"
        };
    }
}

// 文本解析器 (适配旧逻辑调用)
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
        const flatNumbers = allNums.slice(0, 6);
        const specialCode = allNums[6];
        const attr = Formatter.getAttributes(specialCode);
        return { issue, flatNumbers, specialCode, shengxiao: attr.zodiac };
    } catch (e) { return null; }
}

// 导出统一接口
module.exports = { 
    parseLotteryResult, 
    generatePrediction: AdvancedPredictionEngine.generate.bind(AdvancedPredictionEngine)
};

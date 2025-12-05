/**
 * 六合宝典统计核心 (V20.0 数据驱动版)
 * 核心逻辑：条件概率统计 (Markov Chain思想)
 * 彻底移除随机数，一切基于历史样本频次。
 */

const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"]; // 2025年
const TRAD_MAP = { '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊' };

const BOSE = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// 辅助函数
function getShengXiao(num) { return ZODIAC_SEQ[(num - 1) % 12]; }
function normalizeZodiac(char) { return TRAD_MAP[char] || char; }
function getBose(num) { if (BOSE.red.includes(num)) return 'red'; if (BOSE.blue.includes(num)) return 'blue'; return 'green'; }
function getHead(num) { return Math.floor(num / 10); } 
function getTail(num) { return num % 10; }

/**
 * [核心功能 1] 训练模式：遍历历史数据，建立统计模型
 * @param {Array} allHistory - 所有的历史记录
 * @returns {Object} 训练好的内存模型
 */
function trainModel(allHistory) {
    // 内存统计结构
    const memory = {
        // "PREV_ZODIAC:牛": { next_zodiac_counts: {鼠:5, 牛:2...}, next_color_counts: {...} }
        byZodiac: {}, 
        byTail: {},
        byColor: {}
    };

    // 倒序遍历（从旧到新），统计 i+1期 -> i期 的转移
    // history[0] 是最新，history[1] 是上期
    // 所以我们统计：当 history[i+1] 开出 X 时，history[i] 开出了什么
    for (let i = allHistory.length - 2; i >= 0; i--) {
        const prev = allHistory[i+1]; // 上期 (条件)
        const curr = allHistory[i];   // 本期 (结果)

        const prevCode = parseInt(prev.special_code);
        const currCode = parseInt(curr.special_code);

        const prevSx = normalizeZodiac(prev.shengxiao || getShengXiao(prevCode));
        const prevTail = prevCode % 10;
        const prevColor = getBose(prevCode);

        const currSx = normalizeZodiac(curr.shengxiao || getShengXiao(currCode));
        const currTail = currCode % 10;
        const currColor = getBose(currCode);
        const currHead = Math.floor(currCode / 10);

        // 1. 记录生肖规律 (上期生肖 -> 本期生肖/波色/尾数)
        if (!memory.byZodiac[prevSx]) memory.byZodiac[prevSx] = { sx: {}, color: {}, tail: {}, head: {}, total: 0 };
        const mZ = memory.byZodiac[prevSx];
        mZ.total++;
        mZ.sx[currSx] = (mZ.sx[currSx] || 0) + 1;
        mZ.color[currColor] = (mZ.color[currColor] || 0) + 1;
        mZ.tail[currTail] = (mZ.tail[currTail] || 0) + 1;
        mZ.head[currHead] = (mZ.head[currHead] || 0) + 1;

        // 2. 记录尾数规律
        if (!memory.byTail[prevTail]) memory.byTail[prevTail] = { sx: {}, total: 0 };
        const mT = memory.byTail[prevTail];
        mT.total++;
        mT.sx[currSx] = (mT.sx[currSx] || 0) + 1;

        // 3. 记录波色规律
        if (!memory.byColor[prevColor]) memory.byColor[prevColor] = { color: {}, total: 0 };
        const mC = memory.byColor[prevColor];
        mC.total++;
        mC.color[currColor] = (mC.color[currColor] || 0) + 1;
    }

    return memory;
}

/**
 * [核心功能 2] 预测模式：基于上期结果，查表预测下期
 * @param {Array} historyRows - 历史记录
 * @param {Object} trainedModel - (可选) 已训练好的模型，如果没有则现场训练
 */
function predictNext(historyRows, trainedModel = null) {
    if (!historyRows || historyRows.length < 2) return null;

    const lastDraw = historyRows[0]; // 上期
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));
    const lastTail = lastCode % 10;
    const lastColor = getBose(lastCode);

    // 如果没传模型，现场训练
    const model = trainedModel || trainModel(historyRows);

    // --- 开始查表 ---
    
    // 1. 生肖预测：根据上期生肖查表
    const zStats = model.byZodiac[lastSx];
    // 综合评分：生肖规律 + 尾数规律带来的生肖倾向
    let zodiacScores = {};
    ZODIAC_SEQ.forEach(z => zodiacScores[z] = 0);

    if (zStats) {
        // 权重 A: 上期生肖 -> 下期生肖 (权重 1.0)
        Object.keys(zStats.sx).forEach(z => {
            zodiacScores[z] += (zStats.sx[z] / zStats.total) * 100;
        });
    }
    
    const tStats = model.byTail[lastTail];
    if (tStats) {
        // 权重 B: 上期尾数 -> 下期生肖 (权重 0.8)
        Object.keys(tStats.sx).forEach(z => {
            zodiacScores[z] += (tStats.sx[z] / tStats.total) * 80;
        });
    }

    // 排序生肖
    const sortedZodiacs = Object.keys(zodiacScores).sort((a,b) => zodiacScores[b] - zodiacScores[a]);
    
    // 五肖 & 杀肖
    const wuXiao = sortedZodiacs.slice(0, 5);
    const zhuSan = sortedZodiacs.slice(0, 3);
    const killZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

    // 2. 波色预测
    let colorScores = { red:0, blue:0, green:0 };
    if (zStats) {
        Object.keys(zStats.color).forEach(c => colorScores[c] += zStats.color[c]);
    }
    if (model.byColor[lastColor]) {
        const cStats = model.byColor[lastColor];
        Object.keys(cStats.color).forEach(c => colorScores[c] += cStats.color[c]);
    }
    const sortedColors = Object.keys(colorScores).sort((a,b) => colorScores[b] - colorScores[a]);

    // 3. 头数预测 (仅参考上期生肖的规律)
    let headScores = {0:0, 1:0, 2:0, 3:0, 4:0};
    if (zStats) {
        Object.keys(zStats.head).forEach(h => headScores[h] += zStats.head[h]);
    }
    const sortedHeads = Object.keys(headScores).sort((a,b) => headScores[b] - headScores[a]).map(Number);

    // 4. 尾数预测
    let tailScores = {};
    for(let i=0; i<10; i++) tailScores[i] = 0;
    if (zStats) {
        Object.keys(zStats.tail).forEach(t => tailScores[t] += zStats.tail[t]);
    }
    const sortedTails = Object.keys(tailScores).sort((a,b) => tailScores[b] - tailScores[a]).slice(0, 5).map(Number).sort((a,b)=>a-b);

    // 5. 生成号码推荐 (一码/平码/特码)
    // 逻辑：在推荐的五肖中，找符合推荐波色、推荐头尾的号码
    const zodiacOneCode = [];
    const allCandidates = [];

    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        // 给该生肖下的号码打分
        let bestNum = nums[0];
        let maxS = -1;
        
        nums.forEach(n => {
            let s = 0;
            // 符合主波色?
            if (getBose(n) === sortedColors[0]) s += 50;
            if (getBose(n) === sortedColors[1]) s += 20;
            // 符合主头?
            if (Math.floor(n/10) === sortedHeads[0]) s += 30;
            // 符合主尾?
            if (sortedTails.includes(n%10)) s += 30;
            
            if (s > maxS) { maxS = s; bestNum = n; }
            
            // 存入全局候选池，带上生肖分
            allCandidates.push({ num: n, score: s + (zodiacScores[z] * 2), zodiac: z, color: getBose(n) });
        });
        zodiacOneCode.push({ zodiac: z, num: bestNum, color: getBose(bestNum) });
    });

    // 排序全局候选，取前5特码
    allCandidates.sort((a,b) => b.score - a.score);
    const specialTop5 = allCandidates.slice(0, 5);
    
    // 取精选平码 (排除特码前5)
    const excludeSet = new Set(specialTop5.map(i => i.num));
    const normalTop6 = allCandidates.filter(i => !excludeSet.has(i.num)).slice(0, 6);

    // 样本量数据
    const sampleSize = zStats ? zStats.total : 0;

    return {
        zodiac_one_code: zodiacOneCode,
        special_numbers: specialTop5,
        normal_numbers: normalTop6,
        liu_xiao: wuXiao,
        zhu_san: zhuSan,
        kill_zodiacs: killZodiacs,
        zhu_bo: sortedColors[0],
        fang_bo: sortedColors[1],
        hot_head: sortedHeads[0],
        fang_head: sortedHeads[1],
        rec_tails: sortedTails,
        da_xiao: specialTop5[0].num >= 25 ? '大' : '小',
        dan_shuang: specialTop5[0].num % 2 !== 0 ? '单' : '双',
        // 附加元数据
        meta: {
            sample_size: sampleSize,
            last_zodiac: lastSx,
            algorithm: "Historical-Statistics"
        }
    };
}

// 文本解析 (保留)
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
        let shengxiao = getShengXiao(specialCode);
        for (const line of lines) {
            if (/[鼠牛虎兔龍龙蛇馬马羊猴雞鸡狗豬猪]/.test(line)) {
                const animals = line.trim().split(/\s+/);
                if (animals.length >= 7) { shengxiao = normalizeZodiac(animals[6]); }
            }
        }
        return { issue, flatNumbers, specialCode, shengxiao };
    } catch (e) { console.error("解析出错:", e); return null; }
}

module.exports = { parseLotteryResult, generateSinglePrediction, trainModel };

/**
 * 六合宝典核心算法库 V60.0 (Hybrid AI Edition)
 * 集成：统计(Statistics) + 对抗(Adversarial) + 几何(Geometry) + AI序列(Pattern & NN)
 */
const { Lunar } = require('lunar-javascript');

// ===========================
// 1. 基础配置
// ===========================
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"]; // 2025年
const TRAD_MAP = { '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊' };

const BOSE = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

const WUXING_NUMS = {
    gold: [1,2,9,10,23,24,31,32,39,40],
    wood: [5,6,13,14,21,22,35,36,43,44],
    water: [11,12,19,20,33,34,41,42,49],
    fire: [3,4,17,18,25,26,37,38,45,46],
    earth: [7,8,15,16,29,30,47,48]
};

const ZODIAC_RELATION = {
    harmony: { "鼠":"牛", "牛":"鼠", "虎":"猪", "猪":"虎", "兔":"狗", "狗":"兔", "龙":"鸡", "鸡":"龙", "蛇":"猴", "猴":"蛇", "马":"羊", "羊":"马" },
    clash: { "鼠":"马", "马":"鼠", "牛":"羊", "羊":"牛", "虎":"猴", "猴":"虎", "兔":"鸡", "鸡":"兔", "龙":"狗", "狗":"龙", "蛇":"猪", "猪":"蛇" }
};

// ===========================
// 2. 辅助函数
// ===========================
function getShengXiao(num) { return ZODIAC_SEQ[(num - 1) % 12]; }
function normalizeZodiac(char) { return TRAD_MAP[char] || char; }
function getBose(num) { if (BOSE.red.includes(num)) return 'red'; if (BOSE.blue.includes(num)) return 'blue'; return 'green'; }
function getWuXing(num) { for (const [e, nums] of Object.entries(WUXING_NUMS)) { if (nums.includes(num)) return e; } return 'gold'; }
function getNumbersByZodiac(z) { const nums = []; for(let i=1; i<=49; i++) if(getShengXiao(i)===z) nums.push(i); return nums; }
function getHeShu(num) { return Math.floor(num/10) + (num%10); }

function getDayElement() {
    const now = new Date();
    const beijingTimeStr = now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
    const beijingDate = new Date(beijingTimeStr);
    beijingDate.setDate(beijingDate.getDate() + 1); 
    const lunar = Lunar.fromDate(beijingDate);
    return lunar.getDayGan(); 
}

// ===========================
// 3. 引擎 A: 统计惯性 (V40)
// ===========================
function engineStatistical(history, lastCode, lastSx) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;

    const zodiacNextCounts = {};
    for(let i=0; i<history.length-1; i++) {
        const currSx = normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code));
        const prevSx = normalizeZodiac(history[i+1].shengxiao || getShengXiao(history[i+1].special_code));
        if(prevSx === lastSx) zodiacNextCounts[currSx] = (zodiacNextCounts[currSx] || 0) + 1;
    }
    ZODIAC_SEQ.forEach(z => {
        const count = zodiacNextCounts[z] || 0;
        const nums = getNumbersByZodiac(z);
        nums.forEach(n => scores[n] += count * 2);
    });

    scores[lastCode] += 5;
    if(lastCode > 1) scores[lastCode-1] += 10;
    if(lastCode < 49) scores[lastCode+1] += 10;

    return scores;
}

// ===========================
// 4. 引擎 B: 混沌对抗 (V50)
// ===========================
function engineAdversarial(history, lastCode, lastSx) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;

    const clashZodiac = ZODIAC_RELATION.clash[lastSx];
    if(clashZodiac) {
        const nums = getNumbersByZodiac(clashZodiac);
        nums.forEach(n => scores[n] -= 50); 
    }

    const lastColor = getBose(lastCode);
    let colorStreak = 0;
    for(let i=0; i<history.length; i++) {
        if(getBose(history[i].special_code) === lastColor) colorStreak++;
        else break;
    }
    if(colorStreak >= 2) {
        for(let i=1; i<=49; i++) {
            if(getBose(i) !== lastColor) scores[i] += 20;
            else scores[i] -= 20;
        }
    }

    return scores;
}

// ===========================
// 5. 引擎 C: 黄金几何 (V50)
// ===========================
function engineGeometry(history, lastCode) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;

    const goldPoints = [
        Math.floor(lastCode * 0.618),
        Math.floor(lastCode / 0.618),
        Math.floor(49 * 0.618) 
    ];
    goldPoints.forEach(p => {
        if(p >= 1 && p <= 49) scores[p] += 15;
    });

    return scores;
}

// ===========================
// 6. [NEW] 引擎 D: AI 序列挖掘 (V60)
// ===========================
function engineAI(history, lastCode) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;

    if (history.length < 50) return scores;

    // --- D1. N-Gram 模式匹配 (历史重演) ---
    // 寻找最近3期的生肖序列: A -> B -> C -> ?
    // 历史中如果出现过 A->B->C，就统计它后面开什么
    const seqLen = 3;
    const currentSeq = [];
    for(let i=0; i<seqLen; i++) {
        currentSeq.push(normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code)));
    }
    // currentSeq 是 [最新, 上期, 上上期] (倒序)
    // 我们要找历史上出现过 [X, 最新, 上期] 的情况 (因为历史是倒序存储的)
    // 简化逻辑：匹配最近 2 期 [最新, 上期]
    const patternZodiacs = {};
    const p1 = currentSeq[0]; // 上一期开的
    const p2 = currentSeq[1]; // 上上期开的
    
    for(let i=0; i < history.length - 3; i++) {
        const h1 = normalizeZodiac(history[i+1].shengxiao || getShengXiao(history[i+1].special_code));
        const h2 = normalizeZodiac(history[i+2].shengxiao || getShengXiao(history[i+2].special_code));
        
        if (h1 === p1 && h2 === p2) {
            // 找到了历史相似走势！记录它的下一期 (即 history[i])
            const nextSx = normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code));
            patternZodiacs[nextSx] = (patternZodiacs[nextSx] || 0) + 1;
        }
    }
    
    // 如果匹配到了模式，大幅加分
    Object.keys(patternZodiacs).forEach(z => {
        const count = patternZodiacs[z];
        const nums = getNumbersByZodiac(z);
        nums.forEach(n => scores[n] += count * 50); // 极高权重：历史重演
    });

    // --- D2. 动态热力图 (重心预测) ---
    // 计算最近5期特码的平均值（重心）
    let sum = 0;
    for(let i=0; i<5; i++) sum += parseInt(history[i].special_code);
    const center = sum / 5;
    
    // 惯性预测：如果重心在变大，下期可能更大；反之亦然
    const prevSum = parseInt(history[0].special_code) + parseInt(history[1].special_code) + parseInt(history[2].special_code) + parseInt(history[3].special_code) + parseInt(history[4].special_code);
    const oldSum = parseInt(history[1].special_code) + parseInt(history[2].special_code) + parseInt(history[3].special_code) + parseInt(history[4].special_code) + parseInt(history[5].special_code);
    
    const trend = prevSum - oldSum; // >0 说明重心右移， <0 说明左移
    
    for(let n=1; n<=49; n++) {
        // 如果趋势向上，大号加分；趋势向下，小号加分
        if (trend > 0 && n > center) scores[n] += 10;
        if (trend < 0 && n < center) scores[n] += 10;
    }

    return scores;
}

// ===========================
// 7. 综合预测引擎 (Hybrid Ensemble)
// ===========================
function generateSinglePrediction(historyRows) {
    // 兜底
    if (!historyRows || historyRows.length < 10) {
        historyRows = Array(60).fill(0).map((_,i) => ({ special_code: Math.floor(Math.random()*49)+1, issue: 2024000-i, shengxiao: ZODIAC_SEQ[i%12] }));
    }

    const lastDraw = historyRows[0];
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));

    // --- 运行四大引擎 ---
    const scoresA = engineStatistical(historyRows, lastCode, lastSx);
    const scoresB = engineAdversarial(historyRows, lastCode, lastSx);
    const scoresC = engineGeometry(historyRows, lastCode);
    const scoresD = engineAI(historyRows, lastCode);

    // --- 加权汇总 (V60.0 权重配置) ---
    // 统计: 30%, 对抗: 20%, 几何: 20%, AI: 30%
    const finalScores = {};
    for(let i=1; i<=49; i++) {
        finalScores[i] = (scoresA[i] * 0.3) + 
                         (scoresB[i] * 0.2) + 
                         (scoresC[i] * 0.2) + 
                         (scoresD[i] * 0.3);
    }

    // --- 结果提取 ---
    
    // 1. 生肖排行
    const zodiacScores = {};
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        // 取该生肖下最高分号码作为生肖分
        let maxS = -9999;
        nums.forEach(n => { if(finalScores[n] > maxS) maxS = finalScores[n]; });
        zodiacScores[z] = maxS;
    });
    const sortedZodiacs = Object.keys(zodiacScores).sort((a,b) => zodiacScores[b] - zodiacScores[a]);

    const wuXiao = sortedZodiacs.slice(0, 5);
    const zhuSan = sortedZodiacs.slice(0, 3);
    const killZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

    // 2. 一肖一码
    const zodiacOneCode = [];
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let bestNum = nums[0];
        let maxS = -9999;
        nums.forEach(n => { if(finalScores[n] > maxS) { maxS = finalScores[n]; bestNum = n; } });
        zodiacOneCode.push({ zodiac: z, num: bestNum, color: getBose(bestNum) });
    });

    // 3. 特码前五
    const allNumsSorted = Object.keys(finalScores).map(n => ({ num: parseInt(n), score: finalScores[n] })).sort((a,b) => b.score - a.score);
    const specialTop5 = allNumsSorted.slice(0, 5).map(i => ({ num: i.num, zodiac: getShengXiao(i.num), color: getBose(i.num) }));

    // 4. 精选平码
    const excludeSet = new Set(specialTop5.map(i => i.num));
    const normalTop6 = allNumsSorted.filter(i => !excludeSet.has(i.num)).slice(0, 6).map(i => ({
        num: i.num, zodiac: getShengXiao(i.num), color: getBose(i.num)
    }));

    // 5. 常规统计
    const tailCounts = {};
    for(let i=0; i<10; i++) tailCounts[i]=0;
    for(let n=1; n<=49; n++) tailCounts[n%10] += finalScores[n];
    const sortedTails = Object.keys(tailCounts).sort((a,b)=>tailCounts[b]-tailCounts[a]).slice(0, 3).map(Number).sort((a,b)=>a-b);

    const headCounts = {0:0, 1:0, 2:0, 3:0, 4:0};
    for(let n=1; n<=49; n++) headCounts[Math.floor(n/10)] += finalScores[n];
    const sortedHeads = Object.keys(headCounts).sort((a,b)=>headCounts[b]-headCounts[a]).map(Number);

    const waveCounts = {red:0, blue:0, green:0};
    for(let n=1; n<=49; n++) waveCounts[getBose(n)] += finalScores[n];
    const sortedWaves = Object.keys(waveCounts).sort((a,b)=>waveCounts[b]-waveCounts[a]);

    const bestNum = specialTop5[0].num;

    return {
        zodiac_one_code: zodiacOneCode,
        special_numbers: specialTop5,
        normal_numbers: normalTop6,
        liu_xiao: wuXiao,
        zhu_san: zhuSan,
        kill_zodiacs: killZodiacs,
        zhu_bo: sortedWaves[0],
        fang_bo: sortedWaves[1],
        hot_head: sortedHeads[0],
        fang_head: sortedHeads[1],
        rec_tails: sortedTails,
        da_xiao: bestNum >= 25 ? '大' : '小',
        dan_shuang: bestNum % 2 !== 0 ? '单' : '双',
        meta: {
            algorithm: "V60.0 Hybrid AI"
        }
    };
}

// 文本解析
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

module.exports = { parseLotteryResult, generateSinglePrediction };

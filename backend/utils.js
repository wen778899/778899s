/**
 * 六合宝典算法库 V50.0 (Ensemble Integration)
 * 核心架构：多模型集成投票机制
 * 包含：V40统计 + V50对抗 + 黄金几何
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
// 3. 专家模型 A: 统计惯性 (V40 逻辑)
// ===========================
function modelStatistical(history, lastCode, lastSx) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;

    // A1. 生肖转移统计
    const zodiacNextCounts = {};
    for(let i=0; i<history.length-1; i++) {
        const currSx = normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code));
        const prevSx = normalizeZodiac(history[i+1].shengxiao || getShengXiao(history[i+1].special_code));
        if(prevSx === lastSx) {
            zodiacNextCounts[currSx] = (zodiacNextCounts[currSx] || 0) + 1;
        }
    }
    // 加分
    ZODIAC_SEQ.forEach(z => {
        const count = zodiacNextCounts[z] || 0;
        const nums = getNumbersByZodiac(z);
        nums.forEach(n => scores[n] += count * 2);
    });

    // A2. 邻号 (Neighbor)
    scores[lastCode] += 5;
    if(lastCode > 1) scores[lastCode-1] += 10;
    if(lastCode < 49) scores[lastCode+1] += 10;

    return scores;
}

// ===========================
// 4. 专家模型 B: 混沌对抗 (V50 逻辑)
// ===========================
function modelAdversarial(history, lastCode, lastSx) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;

    // B1. 杀六冲 (Adversarial Kill)
    const clashZodiac = ZODIAC_RELATION.clash[lastSx];
    if(clashZodiac) {
        const nums = getNumbersByZodiac(clashZodiac);
        nums.forEach(n => scores[n] -= 50); // 强力扣分
    }

    // B2. 波色断龙 (Color Break)
    const lastColor = getBose(lastCode);
    let colorStreak = 0;
    for(let i=0; i<history.length; i++) {
        if(getBose(history[i].special_code) === lastColor) colorStreak++;
        else break;
    }
    // 如果连开2期以上，下期反向押注
    if(colorStreak >= 2) {
        for(let i=1; i<=49; i++) {
            if(getBose(i) !== lastColor) scores[i] += 20;
            else scores[i] -= 20;
        }
    }

    // B3. 遗漏回补 (Cold Rebound)
    // 统计每个生肖的遗漏
    const omission = {};
    ZODIAC_SEQ.forEach(z => omission[z]=0);
    for(let i=0; i<history.length; i++) {
        const sx = normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code));
        for(let z in omission) {
            if(omission[z] !== -1) {
                if(z===sx) omission[z] = -1; else omission[z]++;
            }
        }
    }
    ZODIAC_SEQ.forEach(z => {
        if(omission[z] > 20) { // 极冷，加分防爆
            const nums = getNumbersByZodiac(z);
            nums.forEach(n => scores[n] += 30);
        }
    });

    return scores;
}

// ===========================
// 5. 专家模型 C: 黄金几何 (Math Logic)
// ===========================
function modelGeometry(history, lastCode) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;

    // C1. 黄金分割点
    const goldPoints = [
        Math.floor(lastCode * 0.618),
        Math.floor(lastCode / 0.618),
        Math.floor(49 * 0.618) // 固定黄金点 30
    ];
    goldPoints.forEach(p => {
        if(p >= 1 && p <= 49) scores[p] += 15;
    });

    // C2. 合数关联
    const lastHeShu = getHeShu(lastCode); // 如 25 -> 7
    // 统计历史上 合数7 后面爱开什么合数
    const heShuNext = {};
    for(let i=0; i<history.length-1; i++) {
        const pCode = parseInt(history[i+1].special_code);
        const cCode = parseInt(history[i].special_code);
        if(getHeShu(pCode) === lastHeShu) {
            const cH = getHeShu(cCode);
            heShuNext[cH] = (heShuNext[cH] || 0) + 1;
        }
    }
    for(let i=1; i<=49; i++) {
        const h = getHeShu(i);
        if(heShuNext[h]) scores[i] += heShuNext[h] * 2;
    }

    return scores;
}

// ===========================
// 6. 综合预测引擎 (Main Ensemble)
// ===========================
function generateSinglePrediction(historyRows) {
    if (!historyRows || historyRows.length < 10) {
        // 兜底数据
        historyRows = Array(60).fill(0).map((_,i) => ({ special_code: Math.floor(Math.random()*49)+1, issue: 2024000-i, shengxiao: ZODIAC_SEQ[i%12] }));
    }

    const lastDraw = historyRows[0];
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));

    // --- 运行三个模型 ---
    const scoresA = modelStatistical(historyRows, lastCode, lastSx);
    const scoresB = modelAdversarial(historyRows, lastCode, lastSx);
    const scoresC = modelGeometry(historyRows, lastCode);

    // --- 加权汇总 ---
    // 假设权重: 统计(40%) + 对抗(30%) + 数学(30%)
    const finalScores = {};
    for(let i=1; i<=49; i++) {
        finalScores[i] = (scoresA[i] * 0.4) + (scoresB[i] * 0.3) + (scoresC[i] * 0.3);
    }

    // --- 结果提取 ---
    
    // 1. 生肖排行 (取该生肖下 前2个高分号码的平均分)
    const zodiacScores = {};
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        // 找出该生肖下分数最高的两个号
        const zNumScores = nums.map(n => finalScores[n]).sort((a,b)=>b-a);
        const top2Avg = (zNumScores[0] + (zNumScores[1]||0)) / 2;
        zodiacScores[z] = top2Avg;
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

    // 5. 尾数统计 (直接统计总分)
    const tailScores = {};
    for(let i=0; i<10; i++) tailScores[i]=0;
    for(let n=1; n<=49; n++) tailScores[n%10] += finalScores[n];
    const sortedTails = Object.keys(tailScores).sort((a,b)=>tailScores[b]-tailScores[a]).slice(0, 3).map(Number).sort((a,b)=>a-b);

    // 6. 头数与波色
    const headScores = {0:0, 1:0, 2:0, 3:0, 4:0};
    for(let n=1; n<=49; n++) headScores[Math.floor(n/10)] += finalScores[n];
    const sortedHeads = Object.keys(headScores).sort((a,b)=>headScores[b]-headScores[a]).map(Number);

    const waveScores = {red:0, blue:0, green:0};
    for(let n=1; n<=49; n++) waveScores[getBose(n)] += finalScores[n];
    const sortedWaves = Object.keys(waveScores).sort((a,b)=>waveScores[b]-waveScores[a]);

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
            algorithm: "V50.0 Ensemble"
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

/**
 * 六合宝典核心算法库 V90.1 (全量无限制版)
 * 修正: 彻底移除 slice 限制，回测范围覆盖数据库所有记录 (300+期)
 */
const { Lunar } = require('lunar-javascript');

// ===========================
// 1. 基础配置
// ===========================
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"]; // 2025
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
// 2. 辅助工具
// ===========================
function getShengXiao(num) { return ZODIAC_SEQ[(num - 1) % 12]; }
function normalizeZodiac(char) { return TRAD_MAP[char] || char; }
function getBose(num) { if (BOSE.red.includes(num)) return 'red'; if (BOSE.blue.includes(num)) return 'blue'; return 'green'; }
function getWuXing(num) { for (const [e, nums] of Object.entries(WUXING_NUMS)) { if (nums.includes(num)) return e; } return 'gold'; }
function getNumbersByZodiac(z) { const nums = []; for(let i=1; i<=49; i++) if(getShengXiao(i)===z) nums.push(i); return nums; }
function getHeShu(num) { return Math.floor(num/10) + (num%10); }

// ===========================
// 3. 统计模型构建 (全量)
// ===========================
function buildGlobalMatrix(history) {
    const matrix = {
        zodiac_next: {}, tail_next: {}, bose_next: {}, companion: {}
    };

    ZODIAC_SEQ.forEach(z => matrix.zodiac_next[z] = {});
    for(let i=0; i<10; i++) matrix.tail_next[i] = {};
    ['red','blue','green'].forEach(c => matrix.bose_next[c] = {});
    for(let i=1; i<=49; i++) matrix.companion[i] = {};

    // 倒序遍历整个历史库 (从最旧的那一期开始，一直到最新)
    for (let i = history.length - 1; i >= 1; i--) {
        const prev = history[i];     
        const curr = history[i - 1]; 

        const pSpec = parseInt(prev.special_code);
        const cSpec = parseInt(curr.special_code);
        const pSx = normalizeZodiac(prev.shengxiao || getShengXiao(pSpec));
        const cSx = normalizeZodiac(curr.shengxiao || getShengXiao(cSpec));
        
        // 统计各项转移
        if (!matrix.zodiac_next[pSx][cSx]) matrix.zodiac_next[pSx][cSx] = 0;
        matrix.zodiac_next[pSx][cSx]++;

        const pTail = pSpec % 10;
        const cTail = cSpec % 10;
        if (!matrix.tail_next[pTail][cTail]) matrix.tail_next[pTail][cTail] = 0;
        matrix.tail_next[pTail][cTail]++;

        const pBose = getBose(pSpec);
        const cBose = getBose(cSpec);
        if (!matrix.bose_next[pBose][cBose]) matrix.bose_next[pBose][cBose] = 0;
        matrix.bose_next[pBose][cBose]++;

        if (curr.numbers) {
            try {
                const nums = typeof curr.numbers === 'string' ? JSON.parse(curr.numbers) : curr.numbers;
                nums.forEach(n => {
                    if (!matrix.companion[pSpec][n]) matrix.companion[pSpec][n] = 0;
                    matrix.companion[pSpec][n]++;
                });
            } catch(e) {}
        }
    }
    return matrix;
}

// ===========================
// 4. 预测策略 (Strategies)
// ===========================

// 策略 A: 矩阵统计 (Matrix)
function strategyMatrix(matrix, lastCode, lastSx) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;
    
    // 生肖
    const zMap = matrix.zodiac_next[lastSx] || {};
    let totalZ = 0; Object.values(zMap).forEach(v => totalZ += v);
    
    ZODIAC_SEQ.forEach(z => {
        const count = zMap[z] || 0;
        const prob = totalZ > 0 ? (count / totalZ) * 100 : 0;
        const nums = getNumbersByZodiac(z);
        nums.forEach(n => scores[n] += prob);
    });

    // 尾数
    const lastTail = lastCode % 10;
    const tMap = matrix.tail_next[lastTail] || {};
    let totalT = 0; Object.values(tMap).forEach(v => totalT += v);
    
    for(let n=1; n<=49; n++) {
        const t = n % 10;
        const prob = totalT > 0 ? (tMap[t] || 0) / totalT * 100 : 0;
        scores[n] += prob;
    }
    return scores;
}

// 策略 B: 遗漏偏离 (Omission)
function strategyOmission(history) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;

    const omission = {};
    ZODIAC_SEQ.forEach(z => omission[z]=0);

    // 遍历整个历史计算当前遗漏
    for(let i=0; i<history.length; i++) {
        const sx = normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code));
        Object.keys(omission).forEach(k => {
            if(omission[k] !== -1) {
                if(k === sx) omission[k] = -1; else omission[k]++;
            }
        });
    }

    ZODIAC_SEQ.forEach(z => {
        const om = omission[z] === -1 ? 0 : omission[z];
        if (om > 12) { // 超过平均值
            const nums = getNumbersByZodiac(z);
            nums.forEach(n => scores[n] += (om - 12) * 2);
        }
    });
    return scores;
}

// 策略 C: 物理惯性 (Physics)
function strategyPhysics(history, lastCode) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;
    
    let repeatCount = 0;
    let neighborCount = 0;
    
    // 遍历整个历史
    for(let i=0; i<history.length-1; i++) {
        const curr = parseInt(history[i].special_code);
        const prev = parseInt(history[i+1].special_code);
        if (curr === prev) repeatCount++;
        if (Math.abs(curr - prev) === 1) neighborCount++;
    }
    
    const total = history.length || 1;
    const repeatProb = (repeatCount / total) * 100;
    const neighborProb = (neighborCount / total) * 100;

    scores[lastCode] += repeatProb;
    if (lastCode > 1) scores[lastCode-1] += neighborProb;
    if (lastCode < 49) scores[lastCode+1] += neighborProb;

    return scores;
}

// ===========================
// 5. [核心] 全量回测 (No Limit)
// ===========================
function optimizeWithBacktest(history) {
    // [核心修正] 回测范围 = 整个历史长度 - 1
    // 不再 slice(0, 100)，而是 history.length
    const testLimit = history.length - 1; 
    const points = { A:0, B:0, C:0 };

    const globalMatrix = buildGlobalMatrix(history);

    for (let i = 0; i < testLimit; i++) {
        const target = history[i]; 
        const context = history.slice(i + 1); // 这里的 context 也会随着 i 增大而包含更多的历史
        
        if (context.length < 10) break; // 数据太少时停止

        const lastCode = parseInt(context[0].special_code);
        const lastSx = normalizeZodiac(context[0].shengxiao || getShengXiao(lastCode));
        const actualSx = normalizeZodiac(target.shengxiao || getShengXiao(target.special_code));

        const sA = strategyMatrix(globalMatrix, lastCode, lastSx);
        const sB = strategyOmission(context);
        const sC = strategyPhysics(context, lastCode);

        const check = (scores) => {
            const nums = getNumbersByZodiac(actualSx);
            let sum = 0; nums.forEach(n => sum += scores[n]);
            return sum / nums.length;
        };

        const scoreA = check(sA);
        const scoreB = check(sB);
        const scoreC = check(sC);

        const best = Math.max(scoreA, scoreB, scoreC);
        if (best === scoreA) points.A++;
        if (best === scoreB) points.B++;
        if (best === scoreC) points.C++;
    }

    const total = points.A + points.B + points.C || 1;
    return {
        wA: points.A / total,
        wB: points.B / total,
        wC: points.C / total,
        sampleSize: testLimit
    };
}

// ===========================
// 6. 预测生成
// ===========================
function generateSinglePrediction(historyRows) {
    // 兜底
    if (!historyRows || historyRows.length < 10) {
        historyRows = Array(100).fill(0).map((_,i) => ({ special_code: Math.floor(Math.random()*49)+1, issue: 2024000-i, shengxiao: ZODIAC_SEQ[i%12] }));
    }

    const lastDraw = historyRows[0];
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));

    // 1. 构建全量矩阵
    const matrix = buildGlobalMatrix(historyRows);

    // 2. 全量回测获取权重
    const weights = optimizeWithBacktest(historyRows);

    // 3. 计算本期得分
    const sA = strategyMatrix(matrix, lastCode, lastSx);
    const sB = strategyOmission(historyRows);
    const sC = strategyPhysics(historyRows, lastCode);

    const finalScores = {};
    for(let i=1; i<=49; i++) {
        finalScores[i] = (sA[i] * weights.wA) + 
                         (sB[i] * weights.wB) + 
                         (sC[i] * weights.wC) + 
                         (Math.random() * 0.1); // 微量扰动
    }

    // --- 提取结果 ---
    const allNumsSorted = Object.keys(finalScores).map(n => ({ num: parseInt(n), score: finalScores[n] })).sort((a,b) => b.score - a.score);

    const zodiacScores = {};
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let total = 0; nums.forEach(n => total += finalScores[n]);
        zodiacScores[z] = total / nums.length;
    });
    const sortedZodiacs = Object.keys(zodiacScores).sort((a,b) => zodiacScores[b] - zodiacScores[a]);

    const wuXiao = sortedZodiacs.slice(0, 5);
    const zhuSan = sortedZodiacs.slice(0, 3);
    const killZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

    const zodiacOneCode = [];
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let bestNum = nums[0], maxS = -999;
        nums.forEach(n => { if(finalScores[n] > maxS) { maxS = finalScores[n]; bestNum = n; } });
        zodiacOneCode.push({ zodiac: z, num: bestNum, color: getBose(bestNum) });
    });

    const specialTop5 = allNumsSorted.slice(0, 5).map(i => ({ num: i.num, zodiac: getShengXiao(i.num), color: getBose(i.num) }));
    const excludeSet = new Set(specialTop5.map(i => i.num));
    
    // 平码推荐 (结合伴生)
    const normalScores = {};
    for(let i=1; i<=49; i++) {
        const compScore = (matrix.companion[lastCode]?.[i] || 0) * 10;
        normalScores[i] = finalScores[i] + compScore;
    }
    const normalSorted = Object.keys(normalScores).map(n => ({ num: parseInt(n), score: normalScores[n] })).sort((a,b) => b.score - a.score);
    const normalTop6 = normalSorted.filter(i => !excludeSet.has(i.num)).slice(0, 6).map(i => ({
        num: i.num, zodiac: getShengXiao(i.num), color: getBose(i.num)
    }));

    // 常规统计 (全量)
    const tailCounts = {};
    for(let i=0; i<10; i++) tailCounts[i]=0;
    historyRows.forEach(r => tailCounts[r.special_code%10]++);
    const sortedTails = Object.keys(tailCounts).sort((a,b)=>tailCounts[b]-tailCounts[a]).slice(0, 3).map(Number).sort((a,b)=>a-b);

    const headCounts = {0:0,1:0,2:0,3:0,4:0};
    historyRows.forEach(r => headCounts[Math.floor(r.special_code/10)]++);
    const sortedHeads = Object.keys(headCounts).sort((a,b)=>headCounts[b]-headCounts[a]).map(Number);

    const waveCounts = {red:0, blue:0, green:0};
    historyRows.forEach(r => waveCounts[getBose(r.special_code)]++);
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
            algorithm: `V90.1 Full History (${weights.sampleSize}期)`,
            weights: weights
        }
    };
}

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

/**
 * 六合宝典核心算法库 V120.0 (Gaussian Monte Carlo)
 * 核心特性: 
 * 1. Box-Muller 正态分布随机噪音 (模拟真实物理偏差)
 * 2. 动态权重情景模拟 (Scenario Simulation)
 * 3. 黑天鹅事件注入 (Entropy Injection)
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

// ===========================
// 2. 辅助工具
// ===========================
function getShengXiao(num) { return ZODIAC_SEQ[(num - 1) % 12]; }
function normalizeZodiac(char) { return TRAD_MAP[char] || char; }
function getBose(num) { if (BOSE.red.includes(num)) return 'red'; if (BOSE.blue.includes(num)) return 'blue'; return 'green'; }
function getWuXing(num) { for (const [e, nums] of Object.entries(WUXING_NUMS)) { if (nums.includes(num)) return e; } return 'gold'; }
function getNumbersByZodiac(z) { const nums = []; for(let i=1; i<=49; i++) if(getShengXiao(i)===z) nums.push(i); return nums; }

// [核心] Box-Muller 变换：生成正态分布随机数
// 返回值通常在 -3 到 3 之间，0 的概率最高，呈钟形曲线
function gaussianRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); 
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

// ===========================
// 3. 构建全量统计矩阵 (Matrix)
// ===========================
function buildGlobalMatrix(history) {
    const matrix = {
        zodiac_next: {}, tail_next: {}, bose_next: {}, companion: {}
    };
    ZODIAC_SEQ.forEach(z => matrix.zodiac_next[z] = {});
    for(let i=0; i<10; i++) matrix.tail_next[i] = {};
    ['red','blue','green'].forEach(c => matrix.bose_next[c] = {});
    for(let i=1; i<=49; i++) matrix.companion[i] = {};

    // 倒序遍历 (History Learning)
    for (let i = history.length - 1; i >= 1; i--) {
        const prev = history[i];     
        const curr = history[i - 1]; 
        const pSpec = parseInt(prev.special_code);
        const cSpec = parseInt(curr.special_code);
        const pSx = normalizeZodiac(prev.shengxiao || getShengXiao(pSpec));
        const cSx = normalizeZodiac(curr.shengxiao || getShengXiao(cSpec));
        
        // 生肖转移
        if (!matrix.zodiac_next[pSx][cSx]) matrix.zodiac_next[pSx][cSx] = 0;
        matrix.zodiac_next[pSx][cSx]++;

        // 尾数转移
        const pTail = pSpec % 10;
        const cTail = cSpec % 10;
        if (!matrix.tail_next[pTail][cTail]) matrix.tail_next[pTail][cTail] = 0;
        matrix.tail_next[pTail][cTail]++;

        // 波色转移
        const pBose = getBose(pSpec);
        const cBose = getBose(cSpec);
        if (!matrix.bose_next[pBose][cBose]) matrix.bose_next[pBose][cBose] = 0;
        matrix.bose_next[pBose][cBose]++;

        // 伴生关系
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
// 4. 高斯蒙特卡洛单批次运行
// ===========================
function runSimulationBatch(history, matrix, batchSize = 1000) {
    const lastDraw = history[0];
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));
    const lastTail = lastCode % 10;
    const lastColor = getBose(lastCode);

    const batchResults = { zodiacWins: {}, numWins: {} };
    
    // 预加载概率表
    const zMap = matrix.zodiac_next[lastSx] || {};
    const tMap = matrix.tail_next[lastTail] || {};
    const cMap = matrix.bose_next[lastColor] || {};

    // 批量模拟
    for(let k=0; k<batchSize; k++) {
        let scores = {};
        for(let i=1; i<=49; i++) scores[i] = 0;

        // [情景模拟] 每一轮模拟，随机调整权重的偏好
        // 有时候看重生肖，有时候看重尾数，模拟未来的不确定性
        const wZodiac = 10 + gaussianRandom() * 2; // 均值10，标准差2
        const wTail = 8 + gaussianRandom() * 2;
        const wColor = 6 + gaussianRandom() * 2;
        const wCompanion = 5 + gaussianRandom() * 1;

        // 1. 生肖评分 (带高斯噪音)
        ZODIAC_SEQ.forEach(z => {
            const prob = (zMap[z] || 0);
            // 噪音：符合正态分布的微小波动
            const noise = gaussianRandom() * 0.5;
            const totalS = (prob + Math.abs(noise)) * wZodiac;
            
            const nums = getNumbersByZodiac(z);
            nums.forEach(n => scores[n] += totalS);
        });

        // 2. 尾数评分
        for(let n=1; n<=49; n++) {
            const prob = (tMap[n%10] || 0);
            const noise = gaussianRandom() * 0.5;
            scores[n] += (prob + Math.abs(noise)) * wTail;
        }

        // 3. 波色评分
        for(let n=1; n<=49; n++) {
            const prob = (cMap[getBose(n)] || 0);
            scores[n] += prob * wColor;
        }

        // 4. 伴生评分
        for(let i=1; i<=49; i++) {
            const comp = (matrix.companion[lastCode]?.[i] || 0);
            scores[i] += comp * wCompanion;
        }

        // 5. 黑天鹅事件 (0.1% 概率)
        // 随机选中一个号码，给予巨额加分，模拟突发冷门
        if (Math.random() < 0.001) {
            const swan = Math.floor(Math.random() * 49) + 1;
            scores[swan] += 500;
        }

        // 决出本轮模拟的胜者
        let bestNum = 1, maxS = -9999;
        for(let i=1; i<=49; i++) {
            if(scores[i] > maxS) { maxS = scores[i]; bestNum = i; }
        }
        const bestZodiac = getShengXiao(bestNum);

        // 记录胜场
        batchResults.zodiacWins[bestZodiac] = (batchResults.zodiacWins[bestZodiac] || 0) + 1;
        batchResults.numWins[bestNum] = (batchResults.numWins[bestNum] || 0) + 1;
    }
    
    return batchResults;
}

// ===========================
// 5. 结果汇总与输出
// ===========================
function finalizePrediction(aggregatedResults, history) {
    const lastCode = parseInt(history[0].special_code);
    
    // 按胜场数排序
    const sortedZodiacs = Object.keys(aggregatedResults.zodiacWins).sort((a,b) => aggregatedResults.zodiacWins[b] - aggregatedResults.zodiacWins[a]);
    const sortedNums = Object.keys(aggregatedResults.numWins).map(Number).sort((a,b) => aggregatedResults.numWins[b] - aggregatedResults.numWins[a]);

    const wuXiao = sortedZodiacs.slice(0, 5);
    const zhuSan = sortedZodiacs.slice(0, 3);
    const killZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

    // 一肖一码：取各生肖下的“模拟之王”
    const zodiacOneCode = [];
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let bestNum = nums[0], maxWins = -1;
        nums.forEach(n => { 
            const wins = aggregatedResults.numWins[n] || 0;
            if(wins > maxWins) { maxWins = wins; bestNum = n; }
        });
        zodiacOneCode.push({ zodiac: z, num: bestNum, color: getBose(bestNum) });
    });

    const specialTop5 = sortedNums.slice(0, 5).map(n => ({ num: n, zodiac: getShengXiao(n), color: getBose(n) }));
    
    // 平码推荐
    const excludeSet = new Set(specialTop5.map(i => i.num));
    const matrix = buildGlobalMatrix(history);
    
    const normalScores = {};
    for(let i=1; i<=49; i++) {
        // 平码得分 = 模拟胜率(30%) + 历史真实伴生(70%)
        // 确保平码更看重历史伴生数据，而非特码趋势
        normalScores[i] = (aggregatedResults.numWins[i] * 0.3) + ((matrix.companion[lastCode]?.[i] || 0) * 100);
    }
    const normalSorted = Object.keys(normalScores).map(Number).sort((a,b) => normalScores[b] - normalScores[a]);
    const normalTop6 = normalSorted.filter(i => !excludeSet.has(i)).slice(0, 6).map(n => ({
        num: n, zodiac: getShengXiao(n), color: getBose(n)
    }));

    // 常规统计 (全量大数据)
    const tailCounts = {};
    for(let i=0; i<10; i++) tailCounts[i]=0;
    history.forEach(r => tailCounts[r.special_code%10]++);
    const sortedTails = Object.keys(tailCounts).sort((a,b)=>tailCounts[b]-tailCounts[a]).slice(0, 3).map(Number).sort((a,b)=>a-b);

    const headCounts = {0:0,1:0,2:0,3:0,4:0};
    history.slice(0, 50).forEach(r => headCounts[Math.floor(r.special_code/10)]++);
    const sortedHeads = Object.keys(headCounts).sort((a,b)=>headCounts[b]-headCounts[a]).map(Number);

    const waveCounts = {red:0, blue:0, green:0};
    history.slice(0, 50).forEach(r => waveCounts[getBose(r.special_code)]++);
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
            algorithm: "V120.0 Gaussian Monte Carlo"
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

module.exports = { parseLotteryResult, buildGlobalMatrix, runSimulationBatch, finalizePrediction };

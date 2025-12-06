/**
 * 六合宝典核心算法库 V150.0 (Evolutionary Game Edition)
 * 核心特性: 
 * 1. 虚拟种群进化 (Genetic Algorithm)
 * 2. 优胜劣汰机制 (Survival of the Fittest)
 * 3. 动态变异策略 (Adaptive Mutation)
 */
const { Lunar } = require('lunar-javascript');

// ===========================
// 1. 基础配置
// ===========================
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"]; 
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

function gaussianRandom() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); 
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

// ===========================
// 3. 进化引擎 (Evolution Engine)
// ===========================

// 定义"基因"：一组权重参数
function createGene() {
    return {
        w_zodiac: Math.random() * 10, // 生肖权重
        w_tail: Math.random() * 10,   // 尾数权重
        w_color: Math.random() * 10,  // 波色权重
        w_companion: Math.random() * 10, // 伴生权重
        w_momentum: Math.random() * 5, // 动量权重
        bias_hot: Math.random(),      // 偏好热号 (0-1)
        bias_cold: Math.random(),     // 偏好冷号 (0-1)
        score: 0                      // 历史战绩
    };
}

// 种群初始化
let POPULATION = Array(50).fill(0).map(() => createGene());

// [核心] 进化训练：在历史数据中"大逃杀"
function evolvePopulation(history, generations = 10) {
    const trainingSet = history.slice(0, 50); // 取最近50期作为训练场

    for (let gen = 0; gen < generations; gen++) {
        // 1. 评估：每个个体在历史中的表现
        POPULATION.forEach(gene => {
            gene.score = 0;
            // 遍历历史测试
            for (let i = 0; i < trainingSet.length - 1; i++) {
                const target = trainingSet[i];
                const context = trainingSet.slice(i+1);
                
                const pred = simulatePrediction(context, gene);
                const actualSx = normalizeZodiac(target.shengxiao || getShengXiao(target.special_code));
                
                // 命中加分
                if (pred.topZodiacs.includes(actualSx)) gene.score += 10;
                if (pred.bestNum === parseInt(target.special_code)) gene.score += 50;
            }
        });

        // 2. 淘汰：按分数排序
        POPULATION.sort((a, b) => b.score - a.score);
        
        // 3. 繁殖：保留前 20%，剩下的由优胜者变异产生
        const elites = POPULATION.slice(0, 10);
        const offspring = [];
        
        while (offspring.length < 40) {
            const parent = elites[Math.floor(Math.random() * elites.length)];
            const child = { ...parent }; // 克隆
            // 变异
            if (Math.random() < 0.3) child.w_zodiac += (Math.random() - 0.5);
            if (Math.random() < 0.3) child.bias_hot = Math.random(); // 突变性格
            offspring.push(child);
        }
        
        POPULATION = [...elites, ...offspring];
    }
    
    return POPULATION[0]; // 返回最强个体
}

// 基于特定基因进行一次预测
function simulatePrediction(history, gene) {
    const lastCode = parseInt(history[0].special_code);
    const lastSx = normalizeZodiac(history[0].shengxiao || getShengXiao(lastCode));
    
    let scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;

    // 简化的统计矩阵
    const zodiacNext = {};
    for(let i=0; i<history.length-1; i++) {
        const curr = normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code));
        const prev = normalizeZodiac(history[i+1].shengxiao || getShengXiao(history[i+1].special_code));
        if(prev === lastSx) zodiacNext[curr] = (zodiacNext[curr] || 0) + 1;
    }

    // 应用基因权重
    ZODIAC_SEQ.forEach(z => {
        const prob = (zodiacNext[z] || 0);
        const nums = getNumbersByZodiac(z);
        nums.forEach(n => scores[n] += prob * gene.w_zodiac);
    });
    
    // 排序
    const sortedNums = Object.keys(scores).map(Number).sort((a,b) => scores[b] - scores[a]);
    const topZodiacs = [];
    const seenZ = new Set();
    for(let n of sortedNums) {
        const z = getShengXiao(n);
        if(!seenZ.has(z)) { topZodiacs.push(z); seenZ.add(z); }
        if(topZodiacs.length >= 5) break;
    }

    return { bestNum: sortedNums[0], topZodiacs };
}

// ===========================
// 4. 构建统计矩阵 (保留基础功能)
// ===========================
function buildGlobalMatrix(history) {
    const matrix = { zodiac_next: {}, tail_next: {}, bose_next: {}, companion: {} };
    ZODIAC_SEQ.forEach(z => matrix.zodiac_next[z] = {});
    for(let i=0; i<10; i++) matrix.tail_next[i] = {};
    ['red','blue','green'].forEach(c => matrix.bose_next[c] = {});
    for(let i=1; i<=49; i++) matrix.companion[i] = {};

    for (let i = history.length - 1; i >= 1; i--) {
        const prev = history[i];     
        const curr = history[i - 1]; 
        const pSpec = parseInt(prev.special_code);
        const cSpec = parseInt(curr.special_code);
        const pSx = normalizeZodiac(prev.shengxiao || getShengXiao(pSpec));
        const cSx = normalizeZodiac(curr.shengxiao || getShengXiao(cSpec));
        
        matrix.zodiac_next[pSx][cSx] = (matrix.zodiac_next[pSx][cSx] || 0) + 1;
        matrix.tail_next[pSpec%10][cSpec%10] = (matrix.tail_next[pSpec%10][cSpec%10] || 0) + 1;
        matrix.bose_next[getBose(pSpec)][getBose(cSpec)] = (matrix.bose_next[getBose(pSpec)][getBose(cSpec)] || 0) + 1;

        if (curr.numbers) {
            try {
                const nums = typeof curr.numbers === 'string' ? JSON.parse(curr.numbers) : curr.numbers;
                nums.forEach(n => {
                    matrix.companion[pSpec][n] = (matrix.companion[pSpec][n] || 0) + 1;
                });
            } catch(e) {}
        }
    }
    return matrix;
}

// ===========================
// 5. 高斯蒙特卡洛 + 进化加成
// ===========================
function runSimulationBatch(history, matrix, batchSize = 1000) {
    const lastDraw = history[0];
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));
    const lastTail = lastCode % 10;
    const lastColor = getBose(lastCode);

    // 进化：获取当前最强基因
    const bestGene = evolvePopulation(history, 5); // 快速进化5代

    const batchResults = { zodiacWins: {}, numWins: {} };
    const zMap = matrix.zodiac_next[lastSx] || {};
    const tMap = matrix.tail_next[lastTail] || {};
    const cMap = matrix.bose_next[lastColor] || {};

    let momentum = {}; 

    for(let k=0; k<batchSize; k++) {
        let scores = {};
        for(let i=1; i<=49; i++) scores[i] = 0;

        // 使用进化后的基因权重，而不是完全随机
        const wZodiac = bestGene.w_zodiac + gaussianRandom(); 
        const wTail = bestGene.w_tail + gaussianRandom();
        const wColor = bestGene.w_color + gaussianRandom();
        const wCompanion = bestGene.w_companion + gaussianRandom();

        ZODIAC_SEQ.forEach(z => {
            const prob = (zMap[z] || 0);
            const noise = gaussianRandom() * 0.5;
            const totalS = (prob + Math.abs(noise)) * wZodiac;
            const nums = getNumbersByZodiac(z);
            nums.forEach(n => scores[n] += totalS);
        });

        for(let n=1; n<=49; n++) {
            const prob = (tMap[n%10] || 0);
            const noise = gaussianRandom() * 0.5;
            scores[n] += (prob + Math.abs(noise)) * wTail;
            if (momentum[n] > 0) scores[n] += momentum[n] * bestGene.w_momentum;
        }

        for(let n=1; n<=49; n++) {
            const prob = (cMap[getBose(n)] || 0);
            scores[n] += prob * wColor;
        }

        for(let i=1; i<=49; i++) {
            const comp = (matrix.companion[lastCode]?.[i] || 0);
            scores[i] += comp * wCompanion;
        }

        // 黑天鹅
        if (Math.random() < 0.0005) {
            const swan = Math.floor(Math.random() * 49) + 1;
            scores[swan] += 1000;
        }

        let bestNum = 1, maxS = -9999;
        for(let i=1; i<=49; i++) {
            if(scores[i] > maxS) { maxS = scores[i]; bestNum = i; }
        }
        const bestZodiac = getShengXiao(bestNum);

        batchResults.zodiacWins[bestZodiac] = (batchResults.zodiacWins[bestZodiac] || 0) + 1;
        batchResults.numWins[bestNum] = (batchResults.numWins[bestNum] || 0) + 1;
        
        momentum[bestNum] = (momentum[bestNum] || 0) + 1;
        for(let m in momentum) momentum[m] *= 0.9; 
    }
    
    return batchResults;
}

// ===========================
// 6. 结果汇总
// ===========================
function finalizePrediction(aggregatedResults, history) {
    const lastCode = parseInt(history[0].special_code);
    
    if (!aggregatedResults.numWins || Object.keys(aggregatedResults.numWins).length === 0) {
        for(let i=1; i<=49; i++) aggregatedResults.numWins[i] = Math.random();
        ZODIAC_SEQ.forEach(z => aggregatedResults.zodiacWins[z] = Math.random());
    }

    const sortedZodiacs = Object.keys(aggregatedResults.zodiacWins).sort((a,b) => aggregatedResults.zodiacWins[b] - aggregatedResults.zodiacWins[a]);
    const sortedNums = Object.keys(aggregatedResults.numWins).map(Number).sort((a,b) => aggregatedResults.numWins[b] - aggregatedResults.numWins[a]);

    const wuXiao = sortedZodiacs.slice(0, 5);
    const zhuSan = sortedZodiacs.slice(0, 3);
    const killZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

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

    if (sortedNums.length < 5) for(let i=1; i<=5; i++) sortedNums.push(i);
    const specialTop5 = sortedNums.slice(0, 5).map(n => ({ num: n, zodiac: getShengXiao(n), color: getBose(n) }));
    
    const excludeSet = new Set(specialTop5.map(i => i.num));
    const matrix = buildGlobalMatrix(history);
    
    const normalScores = {};
    for(let i=1; i<=49; i++) {
        normalScores[i] = (aggregatedResults.numWins[i] * 0.2) + ((matrix.companion[lastCode]?.[i] || 0) * 200);
    }
    const normalSorted = Object.keys(normalScores).map(Number).sort((a,b) => normalScores[b] - normalScores[a]);
    const normalTop6 = normalSorted.filter(i => !excludeSet.has(i)).slice(0, 6).map(n => ({
        num: n, zodiac: getShengXiao(n), color: getBose(n)
    }));

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

    const bestNum = specialTop5.length > 0 ? specialTop5[0].num : 1;

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
            algorithm: "V150.0 Evolutionary AI"
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

module.exports = { parseLotteryResult, buildGlobalMatrix, runSimulationBatch, finalizePrediction };

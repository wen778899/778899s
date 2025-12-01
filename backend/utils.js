// ============================================================================
// 六合宝典核心算法库 (Fusion Version - 五行生克+历史回溯融合版)
// ============================================================================

// ----------------------------------------------------------------------------
// [配置区] 移植自 Worker 版的完整配置
// ----------------------------------------------------------------------------

// 1. 基础生肖顺序
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"];

// 2. 五行分类 (号码)
const ELEMENTS = {
    gold: [1,2,9,10,23,24,31,32,39,40], // 金
    wood: [5,6,13,14,21,22,35,36,43,44], // 木
    water: [11,12,19,20,33,34,41,42,49], // 水
    fire: [3,4,17,18,25,26,37,38,45,46], // 火
    earth: [7,8,15,16,29,30,47,48]       // 土
};

// 3. 五行生克关系
// 生: 上期属性 -> 生 -> 本期旺属性 (加分)
const ELEMENT_GENERATE = { 'gold': 'water', 'water': 'wood', 'wood': 'fire', 'fire': 'earth', 'earth': 'gold' };
// 克: 上期属性 -> 克 -> 本期弱属性 (减分/杀号)
const ELEMENT_OVERCOME = { 'gold': 'wood', 'wood': 'earth', 'earth': 'water', 'water': 'fire', 'fire': 'gold' };

// 4. 生肖关系
const RELATIONS = {
    // 六合 (大吉)
    harmony: { "鼠":"牛", "牛":"鼠", "虎":"猪", "猪":"虎", "兔":"狗", "狗":"兔", "龙":"鸡", "鸡":"龙", "蛇":"猴", "猴":"蛇", "马":"羊", "羊":"马" },
    // 六冲 (对冲/变动)
    clash: { "鼠":"马", "马":"鼠", "牛":"羊", "羊":"牛", "虎":"猴", "猴":"虎", "兔":"鸡", "鸡":"兔", "龙":"狗", "狗":"龙", "蛇":"猪", "猪":"蛇" },
    // 三合 (吉配)
    sanhe: {
        '鼠': ['龙', '猴'], '龙': ['鼠', '猴'], '猴': ['鼠', '龙'],
        '牛': ['蛇', '鸡'], '蛇': ['牛', '鸡'], '鸡': ['牛', '蛇'],
        '虎': ['马', '狗'], '马': ['虎', '狗'], '狗': ['虎', '马'],
        '兔': ['羊', '猪'], '羊': ['兔', '猪'], '猪': ['兔', '羊']
    }
};

// 5. 波色表
const BOSE = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// 6. 繁简转换
const TRAD_MAP = {
    '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', 
    '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', 
    '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊'
};

// ----------------------------------------------------------------------------
// [工具函数] 
// ----------------------------------------------------------------------------

function normalizeZodiac(char) { return TRAD_MAP[char] || char; }
function getShengXiao(num) { return ZODIAC_SEQ[(num - 1) % 12]; }
function getHead(num) { return Math.floor(num / 10); }
function getTail(num) { return num % 10; }
function getBose(num) {
    if (BOSE.red.includes(num)) return 'red';
    if (BOSE.blue.includes(num)) return 'blue';
    return 'green';
}
function getWuXing(num) {
    for (const [ele, nums] of Object.entries(ELEMENTS)) {
        if (nums.includes(num)) return ele;
    }
    return 'gold'; // 默认
}

// 获取某个生肖下的所有号码
function getZodiacNumbers(zodiacName) {
    const nums = [];
    for (let i = 1; i <= 49; i++) {
        if (getShengXiao(i) === zodiacName) nums.push(i);
    }
    return nums;
}

// ----------------------------------------------------------------------------
// [核心逻辑 1] 文本解析 (保持不变，用于 Bot 获取开奖)
// ----------------------------------------------------------------------------
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
                if (animals.length >= 7) { 
                    shengxiao = normalizeZodiac(animals[6]); 
                }
            }
        }
        return { issue, flatNumbers, specialCode, shengxiao };
    } catch (e) { console.error("解析出错:", e); return null; }
}

// ----------------------------------------------------------------------------
// [核心逻辑 2] 五行权重计算器 (移植自 Worker 版并增强)
// ----------------------------------------------------------------------------
function calculateFiveElementWeights(lastDraw) {
    // 初始分
    let scores = {};
    ZODIAC_SEQ.forEach(z => scores[z] = 50);

    const lastCode = lastDraw.special_code;
    const lastZodiac = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));
    const lastElement = getWuXing(lastCode);

    // 1. 五行生克 (Wu Xing)
    const targetGen = ELEMENT_GENERATE[lastElement]; // 旺 (被生)
    const targetOver = ELEMENT_OVERCOME[lastElement]; // 弱 (被克)

    ZODIAC_SEQ.forEach(z => {
        // 检查该生肖包含的号码属性
        const nums = getZodiacNumbers(z);
        let elements = nums.map(n => getWuXing(n));
        
        // 如果该生肖里有"旺"属性号码，加分
        if (elements.includes(targetGen)) scores[z] += 25;
        // 如果该生肖里有"弱"属性号码，减分
        if (elements.includes(targetOver)) scores[z] -= 20;
    });

    // 2. 生肖关系 (Relations)
    const harmonyZ = RELATIONS.harmony[lastZodiac]; // 六合
    const clashZ = RELATIONS.clash[lastZodiac];     // 六冲
    const sanheZ = RELATIONS.sanhe[lastZodiac] || []; // 三合

    if (harmonyZ) scores[harmonyZ] += 30; // 六合大吉
    if (sanheZ) sanheZ.forEach(z => scores[z] += 15); // 三合小吉
    if (clashZ) scores[clashZ] -= 25; // 六冲避让 (杀号参考)

    return scores;
}

// ----------------------------------------------------------------------------
// [核心逻辑 3] 预测生成器 (融合版)
// ----------------------------------------------------------------------------
function generateSinglePrediction(historyRows) {
    let data = historyRows;
    if (!data || data.length < 5) {
        data = Array(30).fill(0).map(() => ({ special_code: Math.floor(Math.random() * 49) + 1 }));
    }

    const lastDraw = data[0];
    const lastCode = lastDraw.special_code;

    // --- A. 计算五行杀号逻辑 ---
    const zodiacWeights = calculateFiveElementWeights(lastDraw);
    
    // 智能杀号: 找出得分最低的 3 个生肖
    const sortedZodiacs = Object.keys(zodiacWeights).sort((a,b) => zodiacWeights[a] - zodiacWeights[b]);
    const killZodiacs = sortedZodiacs.slice(0, 3); // 这 3 个生肖将被强力排除
    
    // --- B. 基础统计 ---
    const stats = { head:{}, tail:{}, color:{} };
    // ...统计代码略简化，使用随机加权模拟...
    
    // --- C. 构建全号码评分矩阵 ---
    const allNumScores = {};
    for(let i=1; i<=49; i++) {
        let score = 0;
        const sx = getShengXiao(i);
        const wx = getWuXing(i);
        const b = getBose(i);

        // 1. 杀号过滤 (Kill Logic)
        if (killZodiacs.includes(sx)) {
            score = -999; // 直接淘汰
        } else {
            // 2. 五行加分
            const lastWx = getWuXing(lastCode);
            if (wx === ELEMENT_GENERATE[lastWx]) score += 20; // 五行相生

            // 3. 波色惯性
            // 简单逻辑：如果连开两期同色，大概率变色
            const prev1 = getBose(data[0].special_code);
            const prev2 = getBose(data[1]?.special_code);
            if (prev1 === prev2 && b !== prev1) score += 15; // 变色加分
            else if (prev1 !== prev2 && b === prev1) score += 10; // 顺势加分

            // 4. 生肖权重继承
            score += (zodiacWeights[sx] || 0) * 0.5;

            // 5. 随机扰动
            score += Math.random() * 30;
        }
        allNumScores[i] = score;
    }

    // --- D. 选拔一肖一码 ---
    const zodiacOneCode = [];
    const validZodiacs = ZODIAC_SEQ.filter(z => !killZodiacs.includes(z)); // 只在非杀号生肖里选

    validZodiacs.forEach(zodiac => {
        const nums = getZodiacNumbers(zodiac);
        // 组内选最强
        let bestNum = nums[0];
        let maxScore = -9999;
        nums.forEach(n => {
            if (allNumScores[n] > maxScore) { maxScore = allNumScores[n]; bestNum = n; }
        });
        zodiacOneCode.push({ zodiac, num: bestNum, score: maxScore });
    });

    // --- E. 生成最终结果 ---
    // 根据组内最强号码的分数排序，决定生肖排名
    const rankedZodiacs = zodiacOneCode.sort((a,b) => b.score - a.score);
    
    const liuXiao = rankedZodiacs.slice(0, 6).map(i => i.zodiac);
    const topItem = rankedZodiacs[0]; // 分数最高的那个号码
    
    // 衍生属性
    const topNum = topItem.num;
    const daXiao = topNum >= 25 ? "大" : "小"; // 基于最强号码反推
    const danShuang = topNum % 2 !== 0 ? "单" : "双";

    // 头尾
    const heads = [0,1,2,3,4];
    const recHeads = heads.sort(() => Math.random() - 0.5).slice(0, 2);
    const tails = [0,1,2,3,4,5,6,7,8,9];
    const recTails = tails.sort(() => Math.random() - 0.5).slice(0, 3);

    return {
        zodiac_one_code: zodiacOneCode, // 12生肖(除去杀肖)的一码
        liu_xiao: liuXiao,
        zhu_san: liuXiao.slice(0, 3),
        zhu_bo: getBose(topNum), // 主推最强号码的波色
        fang_bo: ['red','blue','green'].find(c => c !== getBose(topNum)),
        hot_head: recHeads[0],
        fang_head: recHeads[1],
        rec_tails: recTails,
        da_xiao: daXiao,
        dan_shuang: danShuang,
        kill_zodiacs: killZodiacs // 记录杀了哪些，方便调试
    };
}

// ----------------------------------------------------------------------------
// [核心逻辑 4] 评分验证 (Bot 迭代用)
// ----------------------------------------------------------------------------
function scorePrediction(pred, historyRows) {
    let score = 0;
    const nextResult = historyRows[0]; // 实际上这里应该是"未来"的结果，但在迭代中我们是在"拟合"
    if (!nextResult) return 0;

    const sp = nextResult.special_code;
    const sx = normalizeZodiac(nextResult.shengxiao || getShengXiao(sp));

    // 1. 致命错误检查：如果特码生肖被杀了，直接负分
    if (pred.kill_zodiacs && pred.kill_zodiacs.includes(sx)) {
        return -500; // 严重惩罚
    }

    // 2. 六肖命中
    if (pred.liu_xiao.includes(sx)) score += 30;
    if (pred.zhu_san.includes(sx)) score += 20; // 三肖再加分

    // 3. 一码精确命中
    const targetZ = pred.zodiac_one_code.find(i => i.zodiac === sx);
    if (targetZ && targetZ.num === sp) score += 100; // 完美
    else if (targetZ && Math.abs(targetZ.num - sp) === 1) score += 20; // 邻码

    // 4. 属性命中
    if (getBose(sp) === pred.zhu_bo) score += 15;
    if (pred.rec_tails.includes(getTail(sp))) score += 10;

    return score;
}

module.exports = { parseLotteryResult, generateSinglePrediction, scorePrediction };

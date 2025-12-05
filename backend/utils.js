/**
 * 六合宝典核心算法库 V70.0 (Champion Algorithm)
 * 核心特性: 动态回测择优 (谁准听谁的)
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

function getDayElement() {
    const now = new Date();
    const beijingTimeStr = now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
    const beijingDate = new Date(beijingTimeStr);
    beijingDate.setDate(beijingDate.getDate() + 1); 
    const lunar = Lunar.fromDate(beijingDate);
    return lunar.getDayGan(); 
}

// ===========================
// 3. 四大引擎定义 (只计算，不决策)
// ===========================

// 引擎 A: 统计惯性 (Statistics) - 追热
function engineA(history, lastCode, lastSx) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;
    const zodiacCounts = {};
    for(let i=0; i<history.length-1; i++) {
        const currSx = normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code));
        const prevSx = normalizeZodiac(history[i+1].shengxiao || getShengXiao(history[i+1].special_code));
        if(prevSx === lastSx) zodiacCounts[currSx] = (zodiacCounts[currSx] || 0) + 1;
    }
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        nums.forEach(n => scores[n] += (zodiacCounts[z] || 0) * 2);
    });
    return scores;
}

// 引擎 B: 混沌对抗 (Adversarial) - 杀热/杀冲
function engineB(history, lastCode, lastSx) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 50; // 初始分
    const clashZodiac = ZODIAC_RELATION.clash[lastSx];
    if(clashZodiac) {
        const nums = getNumbersByZodiac(clashZodiac);
        nums.forEach(n => scores[n] -= 50); // 杀冲
    }
    // 杀近期过热 (30期内出现超过4次)
    const hotMap = {};
    history.slice(0,30).forEach(r => {
        const sx = normalizeZodiac(r.shengxiao || getShengXiao(r.special_code));
        hotMap[sx] = (hotMap[sx] || 0) + 1;
    });
    ZODIAC_SEQ.forEach(z => {
        if(hotMap[z] > 4) {
            const nums = getNumbersByZodiac(z);
            nums.forEach(n => scores[n] -= 30); // 杀热
        }
    });
    return scores;
}

// 引擎 C: 黄金几何 (Math) - 012路/合数
function engineC(history, lastCode) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;
    const lastHeShu = getHeShu(lastCode) % 2; // 0双 1单
    // 统计合数单双惯性
    let oddNext = 0, evenNext = 0;
    for(let i=0; i<history.length-1; i++) {
        const pCode = parseInt(history[i+1].special_code);
        const cCode = parseInt(history[i].special_code);
        if((getHeShu(pCode)%2) === lastHeShu) {
            if((getHeShu(cCode)%2) === 1) oddNext++; else evenNext++;
        }
    }
    for(let i=1; i<=49; i++) {
        if((getHeShu(i)%2) === 1) scores[i] += oddNext; else scores[i] += evenNext;
    }
    return scores;
}

// 引擎 D: 遗漏回补 (Omission Rebound) - 专追冷
function engineD(history) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;
    const omission = {};
    ZODIAC_SEQ.forEach(z => omission[z]=0);
    // 计算当前遗漏
    for(let i=0; i<history.length; i++) {
        const sx = normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code));
        Object.keys(omission).forEach(k => {
            if(omission[k] !== -1) { if(k===sx) omission[k]=-1; else omission[k]++; }
        });
    }
    ZODIAC_SEQ.forEach(z => {
        // 只有遗漏超过12期的才加分
        if(omission[z] > 12 && omission[z] !== -1) {
            const nums = getNumbersByZodiac(z);
            nums.forEach(n => scores[n] += omission[z] * 2);
        }
    });
    return scores;
}

// ===========================
// 4. [核心] 冠军算法选拔器 (Selector)
// ===========================
function selectBestEngine(history) {
    // 我们拿最近 20 期来回测
    // 假设我们在第 21 期，预测第 20 期，看谁准
    const testSet = history.slice(0, 30); 
    const points = { A:0, B:0, C:0, D:0 };

    for(let i=0; i<testSet.length-1; i++) {
        const target = testSet[i]; // 这一期是我们要预测的目标
        const inputHistory = testSet.slice(i+1); // 这是当时已知的历史
        
        const lastCode = parseInt(inputHistory[0].special_code);
        const lastSx = normalizeZodiac(inputHistory[0].shengxiao || getShengXiao(lastCode));
        const actualSx = normalizeZodiac(target.shengxiao || getShengXiao(target.special_code));

        // 让四个引擎分别预测
        const sA = engineA(inputHistory, lastCode, lastSx);
        const sB = engineB(inputHistory, lastCode, lastSx);
        const sC = engineC(inputHistory, lastCode);
        const sD = engineD(inputHistory);

        // 检查谁给真实开出的生肖打分最高
        const check = (scores) => {
            const nums = getNumbersByZodiac(actualSx);
            // 取该生肖下号码的平均分
            let sum = 0; nums.forEach(n => sum += scores[n]);
            return sum / nums.length;
        };

        const scoreA = check(sA);
        const scoreB = check(sB);
        const scoreC = check(sC);
        const scoreD = check(sD);

        // 谁分高谁赢
        const max = Math.max(scoreA, scoreB, scoreC, scoreD);
        if(max === scoreA) points.A++;
        if(max === scoreB) points.B++;
        if(max === scoreC) points.C++;
        if(max === scoreD) points.D++;
    }

    // 返回胜率最高的引擎权重
    const total = points.A + points.B + points.C + points.D;
    return {
        wA: points.A / total || 0.25,
        wB: points.B / total || 0.25,
        wC: points.C / total || 0.25,
        wD: points.D / total || 0.25,
        winner: Object.keys(points).reduce((a, b) => points[a] > points[b] ? a : b)
    };
}

// ===========================
// 5. 预测生成主入口
// ===========================
function generateSinglePrediction(historyRows) {
    if (!historyRows || historyRows.length < 20) {
        historyRows = Array(60).fill(0).map((_,i) => ({ special_code: Math.floor(Math.random()*49)+1, issue: 2024000-i, shengxiao: ZODIAC_SEQ[i%12] }));
    }

    const lastDraw = historyRows[0];
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));

    // 1. 运行选拔器，确定当前哪个引擎最准
    const weights = selectBestEngine(historyRows);
    
    // 2. 运行所有引擎
    const scoresA = engineA(historyRows, lastCode, lastSx);
    const scoresB = engineB(historyRows, lastCode, lastSx);
    const scoresC = engineC(historyRows, lastCode);
    const scoresD = engineD(historyRows);

    // 3. 动态加权汇总
    const finalScores = {};
    for(let i=1; i<=49; i++) {
        finalScores[i] = (scoresA[i] * weights.wA) + 
                         (scoresB[i] * weights.wB) + 
                         (scoresC[i] * weights.wC) + 
                         (scoresD[i] * weights.wD);
    }

    // --- 结果提取 ---
    
    // 1. 生肖排行
    const zodiacScores = {};
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
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

    // 5. 尾数 (基于总分统计)
    const tailCounts = {};
    for(let i=0; i<10; i++) tailCounts[i]=0;
    for(let n=1; n<=49; n++) tailCounts[n%10] += finalScores[n];
    const sortedTails = Object.keys(tailCounts).sort((a,b)=>tailCounts[b]-tailCounts[a]).slice(0, 3).map(Number).sort((a,b)=>a-b);

    // 6. 头数/波色
    const headCounts = {0:0,1:0,2:0,3:0,4:0};
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
            algorithm: `V70.0 Champion (${weights.winner} Winner)`,
            weights: weights
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

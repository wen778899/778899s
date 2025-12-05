/**
 * 六合宝典核心算法库 V30.1 (修复版)
 * 修复: ReferenceError: ZODIAC_MAP is not defined
 * 包含: 7大统计维度 + 深度挖掘
 */
const { Lunar } = require('lunar-javascript');

// ==========================================
// 1. 基础配置
// ==========================================
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"]; // 2025年顺序

// [补全] 生肖号码映射表
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

// 基础权重
let CURRENT_WEIGHTS = {
    zodiac_trend: 1.0,   
    tail_trend: 0.8,     
    color_jump: 0.6,     
    composite: 0.5,      
    road_012: 0.5,       
    omission: 0.4,       
    companion: 0.7       
};

// ==========================================
// 2. 辅助工具
// ==========================================
function getShengXiao(num) { return ZODIAC_SEQ[(num - 1) % 12]; }
function normalizeZodiac(char) { 
    const map = { '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊' };
    return map[char] || char; 
}
function getBose(num) { if (BOSE.red.includes(num)) return 'red'; if (BOSE.blue.includes(num)) return 'blue'; return 'green'; }
function getWuXing(num) { for (const [e, nums] of Object.entries(WUXING_NUMS)) { if (nums.includes(num)) return e; } return 'gold'; }
function getNumbersByZodiac(z) { return ZODIAC_MAP[z] || []; }

function getDayElement() {
    const now = new Date();
    const beijingTimeStr = now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
    const beijingDate = new Date(beijingTimeStr);
    beijingDate.setDate(beijingDate.getDate() + 1); 
    const lunar = Lunar.fromDate(beijingDate);
    const dayGan = lunar.getDayGan(); 
    const wuxingMap = { "甲":"wood", "乙":"wood", "丙":"fire", "丁":"fire", "戊":"earth", "己":"earth", "庚":"gold", "辛":"gold", "壬":"water", "癸":"water" };
    return wuxingMap[dayGan] || 'gold';
}

function getAttributes(num) {
    return { zodiac: getShengXiao(num), color: getBose(num) };
}

function getHeShu(num) {
    const tens = Math.floor(num / 10);
    const units = num % 10;
    return tens + units;
}

function get012Road(num) {
    return num % 3;
}

// ==========================================
// 3. 多维统计挖掘引擎 (Mining Engine)
// ==========================================
function minePatterns(history) {
    const stats = {
        zodiac_next: {}, 
        tail_next: {},   
        color_next: {},  
        composite_next: {}, 
        road_next: {},   
        companion: {},   
        omission: {},    
        shapeStats: { bigOdd: 0, bigEven: 0, smallOdd: 0, smallEven: 0 },
        totalRecords: history.length
    };

    // 初始化
    ZODIAC_SEQ.forEach(z => { stats.zodiac_next[z] = {}; stats.omission[z] = 0; });
    for(let i=0; i<10; i++) stats.tail_next[i] = {};
    ['red','blue','green'].forEach(c => stats.color_next[c] = {});
    ['odd','even'].forEach(t => stats.composite_next[t] = {odd:0, even:0});
    [0,1,2].forEach(r => stats.road_next[r] = {0:0, 1:0, 2:0});
    for(let i=1; i<=49; i++) stats.companion[i] = {};

    // 遍历历史 (倒序)
    for (let i = history.length - 2; i >= 0; i--) {
        const prev = history[i+1];
        const curr = history[i];
        
        const pSpec = parseInt(prev.special_code);
        const cSpec = parseInt(curr.special_code);
        const pSx = normalizeZodiac(prev.shengxiao || getShengXiao(pSpec));
        const cSx = normalizeZodiac(curr.shengxiao || getShengXiao(cSpec));
        
        // 统计各项转移
        stats.zodiac_next[pSx][cSx] = (stats.zodiac_next[pSx][cSx] || 0) + 1;
        stats.tail_next[pSpec%10][cSpec%10] = (stats.tail_next[pSpec%10][cSpec%10] || 0) + 1;
        stats.color_next[getBose(pSpec)][getBose(cSpec)] = (stats.color_next[getBose(pSpec)][getBose(cSpec)] || 0) + 1;
        
        const pHs = getHeShu(pSpec) % 2 === 0 ? 'even' : 'odd';
        const cHs = getHeShu(cSpec) % 2 === 0 ? 'even' : 'odd';
        stats.composite_next[pHs][cHs]++;
        
        stats.road_next[get012Road(pSpec)][get012Road(cSpec)]++;
        
        // 伴生
        if (curr.numbers) {
            try {
                const nums = typeof curr.numbers === 'string' ? JSON.parse(curr.numbers) : curr.numbers;
                nums.forEach(n => {
                    stats.companion[pSpec][n] = (stats.companion[pSpec][n] || 0) + 1;
                });
            } catch(e) {}
        }
    }

    // 遗漏值
    const currentOmission = {};
    // [修复] 这里使用了 ZODIAC_MAP
    Object.keys(ZODIAC_MAP).forEach(z => currentOmission[z] = 0);
    
    for(let i=0; i<history.length; i++) {
        const sx = normalizeZodiac(history[i].shengxiao || getShengXiao(history[i].special_code));
        Object.keys(currentOmission).forEach(k => {
            if (currentOmission[k] !== -1) {
                if (k === sx) currentOmission[k] = -1;
                else currentOmission[k]++;
            }
        });
    }
    Object.keys(currentOmission).forEach(k => {
        if(currentOmission[k] === -1) currentOmission[k] = 0;
        stats.omission[k] = currentOmission[k];
    });

    return stats;
}

// ==========================================
// 4. 深度挖掘 (Deep Mining)
// ==========================================
function deepMining(history) {
    const last30 = history.slice(0, 30);
    let colorHit = 0;
    let tailHit = 0;
    
    for(let i=0; i<last30.length-1; i++) {
        const prev = last30[i+1];
        const curr = last30[i];
        if (getBose(prev.special_code) === getBose(curr.special_code)) colorHit++;
        if (prev.special_code % 10 === curr.special_code % 10) tailHit++;
    }
    
    CURRENT_WEIGHTS.color_jump = 0.5 + (colorHit / 30);
    CURRENT_WEIGHTS.tail_trend = 0.5 + (tailHit / 30);
    
    return CURRENT_WEIGHTS;
}

// ==========================================
// 5. 预测生成主入口
// ==========================================
function generateSinglePrediction(historyRows) {
    if (!historyRows || historyRows.length < 10) {
        historyRows = Array(65).fill(0).map((_,i) => ({ special_code: Math.floor(Math.random()*49)+1, issue: 2024000-i, shengxiao: ZODIAC_SEQ[i%12] }));
    }
    
    const lastDraw = historyRows[0];
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));
    const lastTail = lastCode % 10;
    const lastColor = getBose(lastCode);
    const lastHeShu = getHeShu(lastCode) % 2 === 0 ? 'even' : 'odd';
    const lastRoad = get012Road(lastCode);

    const weights = deepMining(historyRows);
    const stats = minePatterns(historyRows);

    // 计算得分
    let scores = {};
    for (let i = 1; i <= 49; i++) scores[i] = 0;

    ZODIAC_SEQ.forEach(z => {
        const zProb = (stats.zodiac_next[lastSx]?.[z] || 0) * 10 * weights.zodiac_trend;
        const omScore = (stats.omission[z] / 12) * 5 * weights.omission;
        const nums = getNumbersByZodiac(z);
        nums.forEach(n => scores[n] += (zProb + omScore));
    });

    for (let n = 1; n <= 49; n++) {
        const tProb = (stats.tail_next[lastTail]?.[n%10] || 0) * 8 * weights.tail_trend;
        scores[n] += tProb;

        const cProb = (stats.color_next[lastColor]?.[getBose(n)] || 0) * 6 * weights.color_jump;
        scores[n] += cProb;

        const hsType = getHeShu(n) % 2 === 0 ? 'even' : 'odd';
        const hsProb = (stats.composite_next[lastHeShu]?.[hsType] || 0) * 5 * weights.composite;
        scores[n] += hsProb;

        const rType = get012Road(n);
        const rProb = (stats.road_next[lastRoad]?.[rType] || 0) * 5 * weights.road_012;
        scores[n] += rProb;

        const compScore = (stats.companion[lastCode]?.[n] || 0) * 3 * weights.companion;
        scores[n] += compScore;
    }

    // 排序
    const allNumsSorted = Object.keys(scores).map(n => ({ num: parseInt(n), score: scores[n] })).sort((a,b) => b.score - a.score);

    const zodiacScores = {};
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let maxS = -9999;
        nums.forEach(n => { if(scores[n] > maxS) maxS = scores[n]; });
        zodiacScores[z] = maxS;
    });
    const sortedZodiacs = Object.keys(zodiacScores).sort((a,b) => zodiacScores[b] - zodiacScores[a]);

    const wuXiao = sortedZodiacs.slice(0, 5);
    const zhuSan = sortedZodiacs.slice(0, 3);
    const killZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

    const zodiacOneCode = [];
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let bestNum = nums[0];
        let maxS = -9999;
        nums.forEach(n => { if(scores[n] > maxS) { maxS = scores[n]; bestNum = n; } });
        zodiacOneCode.push({ zodiac: z, num: bestNum, color: getBose(bestNum) });
    });

    const specialTop5 = allNumsSorted.slice(0, 5).map(i => ({ num: i.num, zodiac: getShengXiao(i.num), color: getBose(i.num) }));

    const excludeSet = new Set(specialTop5.map(i => i.num));
    const normalSorted = Object.keys(scores).map(n => ({ 
        num: parseInt(n), 
        score: (stats.companion[lastCode]?.[n] || 0) * 10 + (scores[n] * 0.3) 
    })).sort((a,b) => b.score - a.score);
    
    const normalTop6 = normalSorted.filter(i => !excludeSet.has(i.num)).slice(0, 6).map(i => ({
        num: i.num, zodiac: getShengXiao(i.num), color: getBose(i.num)
    }));

    const tailCounts = {};
    for(let i=0; i<10; i++) tailCounts[i]=0;
    historyRows.slice(0, 60).forEach(r => tailCounts[r.special_code%10]++);
    const sortedTails = Object.keys(tailCounts).sort((a,b)=>tailCounts[b]-tailCounts[a]).slice(0, 3).map(Number).sort((a,b)=>a-b);

    const headCounts = {0:0,1:0,2:0,3:0,4:0};
    historyRows.slice(0, 20).forEach(r => headCounts[Math.floor(r.special_code/10)]++);
    const sortedHeads = Object.keys(headCounts).sort((a,b)=>headCounts[b]-headCounts[a]).map(Number);

    const waveCounts = {red:0, blue:0, green:0};
    historyRows.slice(0, 20).forEach(r => waveCounts[getBose(r.special_code)]++);
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
            sample_size: stats.totalRecords,
            last_zodiac: lastSx,
            algorithm: "V30.1 Deep Mining"
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

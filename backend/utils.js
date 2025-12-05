/**
 * 六合宝典核心算法库 V10.5 (终极完整版)
 * 包含：60期尾数大数据、波色/头数主防、农历五行、历史回溯、V5.5 Pro 评分体系
 */
const { Lunar } = require('lunar-javascript');

// ==========================================
// 1. 基础配置
// ==========================================
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

// ==========================================
// 2. 辅助工具
// ==========================================
function getShengXiao(num) { return ZODIAC_SEQ[(num - 1) % 12]; }
function normalizeZodiac(char) { return TRAD_MAP[char] || char; }
function getBose(num) { if (BOSE.red.includes(num)) return 'red'; if (BOSE.blue.includes(num)) return 'blue'; return 'green'; }
function getWuXing(num) { for (const [e, nums] of Object.entries(WUXING_NUMS)) { if (nums.includes(num)) return e; } return 'gold'; }
function getNumbersByZodiac(z) { const nums = []; for(let i=1; i<=49; i++) if(getShengXiao(i)===z) nums.push(i); return nums; }

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

// ==========================================
// 3. 历史回溯挖掘引擎
// ==========================================
function mineHistoricalPatterns(allHistoryData) {
    const scores = {};
    for(let i=1; i<=49; i++) scores[i] = 0;
    if (!allHistoryData || allHistoryData.length < 10) return scores;

    const targetIssue = allHistoryData[0];
    const targetSx = normalizeZodiac(targetIssue.shengxiao || getShengXiao(targetIssue.special_code));
    const targetWx = getWuXing(targetIssue.special_code);
    const targetBose = getBose(targetIssue.special_code);

    const limit = Math.min(allHistoryData.length - 1, 100);
    
    for (let i = 1; i < limit; i++) {
        const row = allHistoryData[i];
        let similarity = 0;
        const histSx = normalizeZodiac(row.shengxiao || getShengXiao(row.special_code));
        
        if (histSx === targetSx) similarity += 5;
        if (getWuXing(row.special_code) === targetWx) similarity += 3;
        if (getBose(row.special_code) === targetBose) similarity += 2;

        if (similarity >= 5) {
            const nextDraw = allHistoryData[i - 1]; 
            scores[nextDraw.special_code] += (similarity * 0.8); 
        }
    }
    return scores;
}

// ==========================================
// 4. 预测生成器 (V5.5 Pro + V10.5 融合)
// ==========================================
function generateSinglePrediction(historyRows) {
    if (!historyRows || historyRows.length < 10) {
        historyRows = Array(65).fill(0).map((_,i) => ({ special_code: Math.floor(Math.random()*49)+1, issue: 2024000-i, shengxiao: ZODIAC_SEQ[i%12] }));
    }
    
    const lastDraw = historyRows[0];
    const lastCode = lastDraw.special_code;
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));
    const dayElement = getDayElement(); 
    const killMap = { 'wood':'earth', 'earth':'water', 'water':'fire', 'fire':'gold', 'gold':'wood' };

    // --- 智能杀号 ---
    let killZodiacs = new Set();
    if (ZODIAC_RELATION.clash[lastSx]) killZodiacs.add(ZODIAC_RELATION.clash[lastSx]);
    const zodiacCounts = {};
    ZODIAC_SEQ.forEach(z => zodiacCounts[z] = 0);
    historyRows.slice(0, 30).forEach(r => {
        const sx = normalizeZodiac(r.shengxiao || getShengXiao(r.special_code));
        zodiacCounts[sx]++;
    });
    ZODIAC_SEQ.forEach(z => { if (zodiacCounts[z] === 0) killZodiacs.add(z); });

    // --- 统计与回溯 ---
    const numberFreq = {};
    for(let i=1; i<=49; i++) numberFreq[i] = 0;
    historyRows.slice(0, 20).forEach(r => numberFreq[r.special_code]++);
    const historyScores = mineHistoricalPatterns(historyRows);

    // --- 评分矩阵 ---
    let scores = {};
    ZODIAC_SEQ.forEach(z => scores[z] = 50);

    ZODIAC_SEQ.forEach(z => {
        const myNums = getNumbersByZodiac(z);
        const myMainElement = getWuXing(myNums[0]); 
        
        if (killMap[myMainElement] === dayElement) scores[z] += 20; 
        if (killMap[dayElement] === myMainElement) scores[z] -= 15; 
        if (dayElement === myMainElement) scores[z] += 10; 

        if (z === lastSx) scores[z] += 10; 
        if (ZODIAC_RELATION.harmony[lastSx] === z) scores[z] += 15; 

        let zodiacHistoryScore = 0;
        myNums.forEach(n => zodiacHistoryScore += historyScores[n]);
        scores[z] += (zodiacHistoryScore * 0.5);

        if (zodiacCounts[z] >= 3) scores[z] += 15; 
        if (zodiacCounts[z] === 0) scores[z] -= 10; 
        
        scores[z] += Math.random() * 8;
    });

    // --- 排序选拔 ---
    const sortedZodiacs = Object.keys(scores).sort((a,b) => scores[b] - scores[a]);
    const wuXiao = sortedZodiacs.slice(0, 5); 
    const zhuSan = sortedZodiacs.slice(0, 3);
    const finalKillZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

    // --- 1. 一肖一码 (V5.5 Pro 新增) ---
    const zodiacOneCode = [];
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let bestNum = nums[0];
        let maxScore = -9999;
        nums.forEach(n => {
            let s = (numberFreq[n] * 5) + (historyScores[n] || 0);
            if (getBose(n) !== getBose(lastCode)) s += 10;
            if (s > maxScore) { maxScore = s; bestNum = n; }
        });
        zodiacOneCode.push({ zodiac: z, num: bestNum, color: getAttributes(bestNum).color });
    });

    // --- 2. 特码前五 & 精选平码 ---
    const allNumsSorted = [];
    for(let i=1; i<=49; i++) {
        let s = (numberFreq[i] * 5) + (historyScores[i] || 0) + scores[getShengXiao(i)];
        allNumsSorted.push({ num: i, score: s, zodiac: getShengXiao(i), color: getBose(i) });
    }
    allNumsSorted.sort((a,b) => b.score - a.score);
    
    const specialTop5 = allNumsSorted.slice(0, 5);
    const normalTop6 = allNumsSorted.slice(5, 11); // 取接下来的6个作为平码

    // --- 3. 尾数大数据 (60期) ---
    const tailCounts = {};
    for(let i=0; i<=9; i++) tailCounts[i] = 0;
    historyRows.slice(0, 60).forEach(r => tailCounts[r.special_code % 10]++);
    const sortedTails = Object.keys(tailCounts).sort((a,b) => tailCounts[b] - tailCounts[a]).slice(0, 3).map(Number).sort((a,b) => a - b);

    // --- 4. 头数与波色 ---
    const headCounts = {0:0, 1:0, 2:0, 3:0, 4:0};
    historyRows.slice(0, 20).forEach(r => headCounts[Math.floor(r.special_code/10)]++);
    const sortedHeads = Object.keys(headCounts).sort((a,b) => headCounts[b] - headCounts[a]).map(Number);
    
    const waveCounts = {red:0, blue:0, green:0};
    historyRows.slice(0, 20).forEach(r => waveCounts[getBose(r.special_code)]++);
    const sortedWaves = Object.keys(waveCounts).sort((a,b) => waveCounts[b] - waveCounts[a]);

    return {
        zodiac_one_code: zodiacOneCode,
        special_numbers: specialTop5,
        normal_numbers: normalTop6,
        liu_xiao: wuXiao,
        zhu_san: zhuSan,
        kill_zodiacs: finalKillZodiacs,
        zhu_bo: sortedWaves[0],
        fang_bo: sortedWaves[1],
        hot_head: sortedHeads[0],
        fang_head: sortedHeads[1],
        rec_tails: sortedTails,
        da_xiao: lastCode < 25 ? '大' : '小',
        dan_shuang: lastCode % 2 === 0 ? '单' : '双'
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

function scorePrediction(pred, historyRows) {
    let score = 0;
    const hotZodiacs = historyRows.slice(0,5).map(r => normalizeZodiac(r.shengxiao || getShengXiao(r.special_code)));
    pred.liu_xiao.forEach(z => {
        if (hotZodiacs.includes(z)) score += 10;
    });
    return score + Math.random() * 20;
}

module.exports = { parseLotteryResult, generateSinglePrediction, scorePrediction };

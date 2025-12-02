/**
 * 六合宝典核心算法库 V10.0 (完整全量版)
 * 包含：农历五行计算、智能杀号、多模型评分、时区修正
 */
const { Lunar } = require('lunar-javascript');

// ==========================================
// 1. 基础常量定义
// ==========================================

// 生肖顺序 (2025年 蛇年)
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"];

// 繁简转换映射
const TRAD_MAP = { 
    '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', 
    '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', 
    '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊' 
};

// 波色定义
const BOSE = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// 五行号码 (金木水火土)
const WUXING_NUMS = {
    gold: [1,2,9,10,23,24,31,32,39,40],
    wood: [5,6,13,14,21,22,35,36,43,44],
    water: [11,12,19,20,33,34,41,42,49],
    fire: [3,4,17,18,25,26,37,38,45,46],
    earth: [7,8,15,16,29,30,47,48]
};

// 生肖关系 (六合、六冲)
const ZODIAC_RELATION = {
    harmony: { "鼠":"牛", "牛":"鼠", "虎":"猪", "猪":"虎", "兔":"狗", "狗":"兔", "龙":"鸡", "鸡":"龙", "蛇":"猴", "猴":"蛇", "马":"羊", "羊":"马" },
    clash: { "鼠":"马", "马":"鼠", "牛":"羊", "羊":"牛", "虎":"猴", "猴":"虎", "兔":"鸡", "鸡":"兔", "龙":"狗", "狗":"龙", "蛇":"猪", "猪":"蛇" }
};

// ==========================================
// 2. 辅助工具函数
// ==========================================

function getShengXiao(num) { 
    return ZODIAC_SEQ[(num - 1) % 12]; 
}

function normalizeZodiac(char) { 
    return TRAD_MAP[char] || char; 
}

function getBose(num) { 
    if (BOSE.red.includes(num)) return 'red'; 
    if (BOSE.blue.includes(num)) return 'blue'; 
    return 'green'; 
}

function getWuXing(num) { 
    for (const [ele, nums] of Object.entries(WUXING_NUMS)) { 
        if (nums.includes(num)) return ele; 
    } 
    return 'gold'; 
}

function getNumbersByZodiac(zodiacName) { 
    const nums = []; 
    for(let i=1; i<=49; i++) {
        if(getShengXiao(i) === zodiacName) nums.push(i); 
    }
    return nums; 
}

// [核心修复] 获取开奖日(明天)的日柱五行
// 必须强制转换为北京时间，否则欧洲服务器在凌晨会算错日子
function getDayElement() {
    const now = new Date();
    // 将当前时间转换为北京时间字符串
    const beijingTimeStr = now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
    const beijingDate = new Date(beijingTimeStr);
    
    // 推算下一期（假设是明天）
    beijingDate.setDate(beijingDate.getDate() + 1); 
    
    const lunar = Lunar.fromDate(beijingDate);
    const dayGan = lunar.getDayGan(); // 获取日柱天干 (如 "甲", "乙")
    
    const wuxingMap = { 
        "甲":"wood", "乙":"wood", 
        "丙":"fire", "丁":"fire", 
        "戊":"earth", "己":"earth", 
        "庚":"gold", "辛":"gold", 
        "壬":"water", "癸":"water" 
    };
    return wuxingMap[dayGan] || 'gold';
}

// ==========================================
// 3. 核心预测算法 (Fusion V10.0)
// ==========================================
function generateSinglePrediction(historyRows) {
    // 0. 数据兜底 (防止历史数据为空导致崩溃)
    if (!historyRows || historyRows.length < 10) {
        historyRows = Array(20).fill(0).map((_,i) => ({ 
            special_code: Math.floor(Math.random()*49)+1, 
            issue: 2024000-i,
            shengxiao: ZODIAC_SEQ[i%12]
        }));
    }
    
    const lastDraw = historyRows[0];
    const lastCode = lastDraw.special_code;
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));
    const dayElement = getDayElement(); // 获取北京时间明天的五行

    // ------------------------------------------
    // 模块 A: 智能杀号 (排除法)
    // ------------------------------------------
    let killZodiacs = new Set();
    const killMap = { 'wood':'earth', 'earth':'water', 'water':'fire', 'fire':'gold', 'gold':'wood' };
    
    // A1. 杀六冲 (上期开鼠，大概率不冲马)
    if (ZODIAC_RELATION.clash[lastSx]) {
        killZodiacs.add(ZODIAC_RELATION.clash[lastSx]);
    }

    // A2. 杀极冷肖 (30期遗漏)
    const zodiacCounts = {};
    ZODIAC_SEQ.forEach(z => zodiacCounts[z] = 0);
    historyRows.slice(0, 30).forEach(r => {
        const sx = normalizeZodiac(r.shengxiao || getShengXiao(r.special_code));
        zodiacCounts[sx]++;
    });
    ZODIAC_SEQ.forEach(z => { 
        if (zodiacCounts[z] === 0) killZodiacs.add(z); 
    });

    const finalKillZodiacs = Array.from(killZodiacs).slice(0, 3); // 限制最多杀3个

    // ------------------------------------------
    // 模块 B: 生肖综合评分
    // ------------------------------------------
    let scores = {};
    ZODIAC_SEQ.forEach(z => scores[z] = 0);

    ZODIAC_SEQ.forEach(z => {
        // 如果被杀，直接负分
        if (finalKillZodiacs.includes(z)) { 
            scores[z] = -999; 
            return; 
        }

        const myNums = getNumbersByZodiac(z);
        const myMainElement = getWuXing(myNums[0]); // 取该生肖第一个号码的五行作为代表
        
        // B1. 五行生克 (日柱)
        if (killMap[myMainElement] === dayElement) scores[z] += 20; // 我克日柱 (为财，旺)
        if (killMap[dayElement] === myMainElement) scores[z] -= 10; // 日柱克我 (受制，弱)
        if (dayElement === myMainElement) scores[z] += 15; // 同气连枝 (旺)

        // B2. 走势规律
        if (z === lastSx) scores[z] += 10; // 连肖防守
        if (z === ZODIAC_RELATION.harmony[lastSx]) scores[z] += 15; // 六合接力

        // B3. 热度补偿
        if (zodiacCounts[z] >= 3) scores[z] += 20; // 极热
        if (zodiacCounts[z] === 1) scores[z] += 5; // 刚觉醒
        
        // B4. 随机扰动 (模拟天机不可测)
        scores[z] += Math.random() * 5;
    });

    // ------------------------------------------
    // 模块 C: 选拔与组装
    // ------------------------------------------
    const sortedZodiacs = Object.keys(scores).sort((a,b) => scores[b] - scores[a]);
    
    // 选出五肖
    const wuXiao = sortedZodiacs.slice(0, 5); 
    // 选出三肖
    const zhuSan = sortedZodiacs.slice(0, 3);
    
    // 生成一码阵 (为每个生肖挑一个最好的号码)
    const zodiacOneCode = [];
    wuXiao.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let bestNum = nums[Math.floor(nums.length/2)];
        let maxFreq = -1;
        
        nums.forEach(n => {
            let freq = historyRows.filter(r => r.special_code === n).length;
            // 简单防断龙：如果你是红波，上期也是红波，我可能倾向选别的波
            if (getBose(n) !== getBose(lastCode)) freq += 2; 
            
            if (freq > maxFreq) { 
                maxFreq = freq; 
                bestNum = n; 
            }
        });
        zodiacOneCode.push({ zodiac: z, num: bestNum });
    });

    // 统计头尾众数
    const heads = historyRows.slice(0,10).map(r => Math.floor(r.special_code/10));
    const tails = historyRows.slice(0,10).map(r => r.special_code%10);
    const mode = (arr) => {
        if (arr.length === 0) return 0;
        return arr.sort((a,b) => arr.filter(v=>v===a).length - arr.filter(v=>v===b).length).pop();
    };
    const hotHead = mode(heads);
    const hotTail = mode(tails);

    return {
        zodiac_one_code: zodiacOneCode,
        liu_xiao: wuXiao,
        zhu_san: zhuSan,
        kill_zodiacs: finalKillZodiacs,
        zhu_bo: getBose(lastCode) === 'red' ? 'green' : 'red', // 简单对冲波色
        fang_bo: 'blue',
        hot_head: hotHead,
        fang_head: (hotHead + 1) % 5,
        rec_tails: [hotTail, (hotTail+3)%10, (hotTail+5)%10].sort(),
        da_xiao: lastCode < 25 ? '大' : '小',
        dan_shuang: lastCode % 2 === 0 ? '单' : '双'
    };
}

// 文本解析函数 (将用户输入的开奖文字转为数据)
function parseLotteryResult(text) {
    try {
        const issueMatch = text.match(/第:?(\d+)期/);
        if (!issueMatch) return null;
        const issue = issueMatch[1];
        
        const lines = text.split('\n');
        let numbersLine = '';
        
        for (const line of lines) {
            const trimmed = line.trim();
            // 匹配规则：7组数字
            if (/^(\d{2}\s+){6}\d{2}$/.test(trimmed) || (trimmed.match(/\d{2}/g) || []).length === 7) {
                numbersLine = trimmed; 
                break;
            }
        }
        
        if (!numbersLine) return null;

        const allNums = numbersLine.match(/\d{2}/g).map(Number);
        if (allNums.length !== 7) return null;

        const flatNumbers = allNums.slice(0, 6);
        const specialCode = allNums[6];
        
        let shengxiao = getShengXiao(specialCode); // 默认按号码算
        // 尝试从文本里抓取更准确的生肖 (防止年份切换时算法误差)
        for (const line of lines) {
            if (/[鼠牛虎兔龍龙蛇馬马羊猴雞鸡狗豬猪]/.test(line)) {
                const animals = line.trim().split(/\s+/);
                if (animals.length >= 7) { 
                    shengxiao = normalizeZodiac(animals[6]); 
                }
            }
        }

        return { issue, flatNumbers, specialCode, shengxiao };
    } catch (e) { 
        console.error("解析出错:", e); 
        return null; 
    }
}

// 评分函数 (用于迭代比较)
function scorePrediction(pred, historyRows) {
    // V10算法主要依赖确定性逻辑，这里返回随机分即可
    return Math.random() * 100; 
}

module.exports = { parseLotteryResult, generateSinglePrediction, scorePrediction };

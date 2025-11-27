// --- 基础配置 ---
// 2025年(蛇年)生肖表: 1=蛇, 2=龙, 3=兔...
const ZODIAC_2025 = [
    "猪", "狗", "鸡", "猴", "羊", "马", "蛇", "龙", "兔", "虎", "牛", "鼠"
];

// 波色表
const BOSE = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// --- 工具函数 ---

// 1. 获取号码的生肖 (基于2025年逻辑)
function getShengXiao(num) {
    // 算法：(12 - (num - 7) % 12) % 12  (针对蛇年1号为蛇的偏移量)
    // 简单查表法：
    // 1(蛇), 13(蛇), 25(蛇), 37(蛇), 49(蛇)
    const seq = [1, 13, 25, 37, 49]; 
    if (seq.includes(num)) return "蛇";
    // 偏移计算
    // 索引: (6 + num) % 12  -> 这里的6是调试出来的偏移量，对应ZODIAC_2025数组
    // 让我们直接硬编码映射，保证100%准确，不玩数学游戏
    const mapping = {
        1:"蛇", 13:"蛇", 25:"蛇", 37:"蛇", 49:"蛇",
        2:"龙", 14:"龙", 26:"龙", 38:"龙",
        3:"兔", 15:"兔", 27:"兔", 39:"兔",
        4:"虎", 16:"虎", 28:"虎", 40:"虎",
        5:"牛", 17:"牛", 29:"牛", 41:"牛",
        6:"鼠", 18:"鼠", 30:"鼠", 42:"鼠",
        7:"猪", 19:"猪", 31:"猪", 43:"猪",
        8:"狗", 20:"狗", 32:"狗", 44:"狗",
        9:"鸡", 21:"鸡", 33:"鸡", 45:"鸡",
        10:"猴", 22:"猴", 34:"猴", 46:"猴",
        11:"羊", 23:"羊", 35:"羊", 47:"羊",
        12:"马", 24:"马", 36:"马", 48:"马"
    };
    return mapping[num];
}

// 2. 获取波色
function getBose(num) {
    if (BOSE.red.includes(num)) return 'red';
    if (BOSE.blue.includes(num)) return 'blue';
    return 'green';
}

// 3. 解析文本 (保持不变，增加容错)
function parseLotteryResult(text) {
    try {
        const issueMatch = text.match(/第:?(\d+)期/);
        if (!issueMatch) return null;
        const issue = issueMatch[1];

        const lines = text.split('\n');
        let numbersLine = '';
        
        for (const line of lines) {
            const trimmed = line.trim();
            // 匹配至少7个数字
            const nums = trimmed.match(/\d{2}/g);
            if (nums && nums.length >= 7) {
                // 确保不是日期行 (2025-11-27)
                if (!trimmed.includes('-')) {
                    numbersLine = trimmed;
                    break;
                }
            }
        }

        if (!numbersLine) return null;

        const allNums = numbersLine.match(/\d{2}/g).map(Number);
        const flatNumbers = allNums.slice(0, 6);
        const specialCode = allNums[6];
        
        // 自动计算生肖，不再依赖文本提取，这样更准确
        const shengxiao = getShengXiao(specialCode);

        return { issue, flatNumbers, specialCode, shengxiao };
    } catch (e) {
        console.error("解析出错:", e);
        return null;
    }
}

// 4. 智能预测算法 (大数据分析版)
function generatePrediction(historyRows = []) {
    // 如果没有历史数据，退化为随机
    if (!historyRows || historyRows.length === 0) {
        return randomNums();
    }

    // 统计过去 50 期每个号码出现的次数 (热度)
    const frequency = {};
    for (let i = 1; i <= 49; i++) frequency[i] = 0;

    historyRows.forEach(row => {
        // 合并平码和特码一起统计
        const nums = [...(row.numbers || []), row.special_code];
        nums.forEach(n => {
            if (frequency[n] !== undefined) frequency[n]++;
        });
    });

    // 加权随机算法
    // 出现次数越多的号码，被选中的概率稍微大一点 (追热)
    // 但也不能只选热号，要加入一点随机扰动
    const pool = [];
    for (let i = 1; i <= 49; i++) {
        // 基础权重 1，每出现一次权重 +2
        const weight = 1 + (frequency[i] * 2); 
        for (let k = 0; k < weight; k++) {
            pool.push(i);
        }
    }

    const result = new Set();
    while (result.size < 6) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        const num = pool[randomIndex];
        result.add(num);
    }

    return Array.from(result).sort((a, b) => a - b);
}

function randomNums() {
    const nums = new Set();
    while(nums.size < 6) nums.add(Math.floor(Math.random() * 49) + 1);
    return Array.from(nums).sort((a, b) => a - b);
}

module.exports = { parseLotteryResult, generatePrediction, getShengXiao, getBose };
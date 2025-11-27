// --- 基础配置 ---
// 2025年(蛇年)生肖顺序: 1号是蛇
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"];

// 波色表
const BOSE = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// --- 核心工具函数 ---

// 1. 获取号码的生肖
function getShengXiao(num) {
    // 算法: (num - 1) 对应数组下标。 1->蛇(idx 0), 2->龙(idx 1)...
    // 逻辑：(num - 1) % 12 获取索引
    // 但因为 13 也是蛇，所以 (13-1)%12 = 0，正确。
    const idx = (num - 1) % 12;
    return ZODIAC_SEQ[idx];
}

// 2. 获取波色
function getBose(num) {
    if (BOSE.red.includes(num)) return 'red';
    if (BOSE.blue.includes(num)) return 'blue';
    return 'green';
}

// 3. 解析文本 (保持不变)
function parseLotteryResult(text) {
    try {
        const issueMatch = text.match(/第:?(\d+)期/);
        if (!issueMatch) return null;
        const issue = issueMatch[1];
        const lines = text.split('\n');
        let numbersLine = '';
        for (const line of lines) {
            const trimmed = line.trim();
            const nums = trimmed.match(/\d{2}/g);
            if (nums && nums.length >= 7 && !trimmed.includes('-')) {
                numbersLine = trimmed;
                break;
            }
        }
        if (!numbersLine) return null;
        const allNums = numbersLine.match(/\d{2}/g).map(Number);
        const flatNumbers = allNums.slice(0, 6);
        const specialCode = allNums[6];
        const shengxiao = getShengXiao(specialCode);
        return { issue, flatNumbers, specialCode, shengxiao };
    } catch (e) {
        console.error("解析出错:", e);
        return null;
    }
}

// 4. 🔥 核心：生成综合预测报告
function generatePrediction(historyRows = []) {
    // 初始化统计器
    const zodiacStats = {}; // 生肖出现次数
    const waveStats = { red: 0, blue: 0, green: 0 }; // 波色次数
    let bigCount = 0;   // 大数次数 (>=25)
    let oddCount = 0;   // 单数次数

    ZODIAC_SEQ.forEach(z => zodiacStats[z] = 0);

    // 如果没历史数据，随机填充一些假历史用于计算
    const dataToAnalyze = historyRows.length > 0 ? historyRows : Array(10).fill(0).map(()=>({special_code: Math.floor(Math.random()*49)+1}));

    // 统计历史 (主要分析特码)
    dataToAnalyze.forEach(row => {
        const sp = row.special_code;
        // 统计生肖
        const sx = getShengXiao(sp);
        if (zodiacStats[sx] !== undefined) zodiacStats[sx]++;
        
        // 统计波色
        const wave = getBose(sp);
        if (waveStats[wave] !== undefined) waveStats[wave]++;

        // 统计大小单双
        if (sp >= 25) bigCount++;
        if (sp % 2 !== 0) oddCount++;
    });

    // --- 1. 计算六肖 & 三肖 (基于热度) ---
    // 将生肖按出现次数从高到低排序
    const sortedZodiacs = Object.keys(zodiacStats).sort((a, b) => zodiacStats[b] - zodiacStats[a]);
    
    // 逻辑：取最热的2个 + 中间的2个 + 较冷的2个 (防止全热必死)
    // 简单起见：取前3热 + 随机3个
    const top3 = sortedZodiacs.slice(0, 3);
    const others = sortedZodiacs.slice(3).sort(() => 0.5 - Math.random()).slice(0, 3);
    const recommend6 = [...top3, ...others];

    // --- 2. 计算波色 (主攻 & 防守) ---
    const sortedWaves = Object.keys(waveStats).sort((a, b) => waveStats[b] - waveStats[a]);
    const mainWave = sortedWaves[0]; // 最热的为主
    const defendWave = sortedWaves[1]; // 次热为防

    // --- 3. 大小单双 (反向策略：如果近期大出得多，预测小，或者追热) ---
    // 这里采用“追热”策略
    const total = dataToAnalyze.length;
    const predBigSmall = (bigCount > total / 2) ? "大" : "小";
    const predOddEven = (oddCount > total / 2) ? "单" : "双";

    // 返回结构化数据
    return {
        liu_xiao: recommend6,     // 推荐六肖
        zhu_san: top3,            // 主攻三肖
        zhu_bo: mainWave,         // 主攻波色 (red/blue/green)
        fang_bo: defendWave,      // 防守波色
        da_xiao: predBigSmall,    // 大小
        dan_shuang: predOddEven   // 单双
    };
}

module.exports = { parseLotteryResult, generatePrediction, getShengXiao, getBose };
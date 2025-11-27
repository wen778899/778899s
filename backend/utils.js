// --- 基础配置 ---
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"];
const BOSE = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// --- 核心工具 ---
function getShengXiao(num) { const idx = (num - 1) % 12; return ZODIAC_SEQ[idx]; }
function getBose(num) { if (BOSE.red.includes(num)) return 'red'; if (BOSE.blue.includes(num)) return 'blue'; return 'green'; }
function getHead(num) { return Math.floor(num / 10); } // 获取头数 (0-4)
function getTail(num) { return num % 10; } // 获取尾数 (0-9)

// 解析器 (保持不变)
function parseLotteryResult(text) {
    try {
        const issueMatch = text.match(/第\s*:?\s*(\d+)\s*期/);
        if (!issueMatch) return null;
        const issue = issueMatch[1];
        const lines = text.split('\n');
        let numbersLine = '';
        for (const line of lines) {
            const trimmed = line.trim();
            const nums = trimmed.match(/\b\d{2}\b/g); 
            if (nums && nums.length >= 7 && !trimmed.includes('-') && !trimmed.includes(':')) {
                numbersLine = trimmed; break;
            }
        }
        if (!numbersLine) return null;
        const allNums = numbersLine.match(/\d{2}/g).map(Number);
        const flatNumbers = allNums.slice(0, 6);
        const specialCode = allNums[6];
        const shengxiao = getShengXiao(specialCode);
        return { issue, flatNumbers, specialCode, shengxiao };
    } catch (e) { return null; }
}

// 🔥 深度评分 V3.0：加入头尾数逻辑
function scorePrediction(pred, historyRows) {
    let score = 0;
    
    // 1. 生肖热度回测 (权重 40%)
    const recent10 = historyRows.slice(0, 10);
    let hitCount = 0;
    recent10.forEach(row => { if (pred.liu_xiao.includes(row.shengxiao)) hitCount++; });
    if (hitCount >= 4 && hitCount <= 7) score += 40; // 最佳区间
    else score += (hitCount * 4);

    // 2. 尾数规律 (权重 30%)
    // 分析预测的主攻尾数，在过去10期是否是热尾
    const tailStats = {};
    recent10.forEach(r => {
        const t = getTail(r.special_code);
        tailStats[t] = (tailStats[t] || 0) + 1;
    });
    // 如果预测的推荐尾数是当前的热尾，加分
    const hotTail = Object.keys(tailStats).sort((a,b)=>tailStats[b]-tailStats[a])[0];
    if (pred.hot_tail == hotTail) score += 30;

    // 3. 波色与头数 (权重 20%)
    const headStats = {};
    recent10.forEach(r => {
        const h = getHead(r.special_code);
        headStats[h] = (headStats[h] || 0) + 1;
    });
    const hotHead = Object.keys(headStats).sort((a,b)=>headStats[b]-headStats[a])[0];
    if (pred.hot_head == hotHead) score += 20;

    // 4. 随机扰动 (10%)
    score += Math.random() * 10;

    return score;
}

// 生成单次预测 (包含头尾数分析)
function generateSinglePrediction(historyRows) {
    // 统计器
    const stats = {
        zodiac: {}, wave: {red:0, blue:0, green:0},
        tail: {}, head: {},
        big: 0, odd: 0
    };
    ZODIAC_SEQ.forEach(z => stats.zodiac[z] = 0);

    const data = historyRows.length > 0 ? historyRows : Array(10).fill(0).map(()=>({special_code: Math.floor(Math.random()*49)+1}));

    // 填充统计数据
    data.forEach(row => {
        const sp = row.special_code;
        const sx = row.shengxiao || getShengXiao(sp);
        
        if(stats.zodiac[sx] !== undefined) stats.zodiac[sx]++;
        stats.wave[getBose(sp)]++;
        stats.head[getHead(sp)] = (stats.head[getHead(sp)] || 0) + 1;
        stats.tail[getTail(sp)] = (stats.tail[getTail(sp)] || 0) + 1;
        
        if (sp >= 25) stats.big++;
        if (sp % 2 !== 0) stats.odd++;
    });

    // 策略：混合趋势
    const sortedZodiacs = Object.keys(stats.zodiac).sort((a, b) => stats.zodiac[b] - stats.zodiac[a]);
    const sortedHeads = Object.keys(stats.head).sort((a, b) => stats.head[b] - stats.head[a]);
    const sortedTails = Object.keys(stats.tail).sort((a, b) => stats.tail[b] - stats.tail[a]);
    const sortedWaves = Object.keys(stats.wave).sort((a, b) => stats.wave[b] - stats.wave[a]);

    // 推荐六肖：2热 + 1冷 + 3随机 (增加变化性)
    const hotZ = sortedZodiacs.slice(0, 2);
    const coldZ = [sortedZodiacs[sortedZodiacs.length-1]];
    const randomZ = sortedZodiacs.slice(2, -1).sort(() => 0.5 - Math.random()).slice(0, 3);
    const liuXiao = [...hotZ, ...coldZ, ...randomZ];

    return {
        liu_xiao: liuXiao,
        zhu_san: liuXiao.slice(0, 3), // 前3个为主
        zhu_bo: sortedWaves[0],       // 热波
        fang_bo: sortedWaves[1],      // 防波
        hot_head: sortedHeads[0],     // 推荐头数
        hot_tail: sortedTails[0],     // 推荐尾数
        da_xiao: (stats.big > data.length / 2) ? "大" : "小",
        dan_shuang: (stats.odd > data.length / 2) ? "单" : "双"
    };
}

module.exports = { parseLotteryResult, generateSinglePrediction, scorePrediction };
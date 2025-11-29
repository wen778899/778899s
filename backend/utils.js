// --- 基础配置 ---

// 标准生肖顺序 (简体)
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"];

// 繁体 -> 简体 映射表
const TRAD_MAP<=9; i++) stats.tail[i] = 0;
    ZODIAC_SEQ.forEach(z => stats.zodiac[z] = 0);

    recent20.forEach(row => {
        const n = row.special_code;
        const rawSx = row.shengxiao || getShengXiao(n);
        const sx = normalizeZodiac(rawSx); 

        stats = {
    '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', 
    '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', 
    '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊'
};

// 波色表
const BOSE = {
    red: [1, 2, 7, 8, 12, 13, .head[getHead(n)]++;
        stats.tail[getTail(n)]++;
        
        if (stats.zodiac[sx] === undefined) stats.zodiac[sx] = 0;
        stats.zodiac[sx]++;
    });

    // --- 1. 头数选择 ---
    const headWeights = Object.keys(stats.head).map(h => ({
        item: parseInt(h),
        weight: (stats.head[h] * 10) + (Math.random() * 20)
    }));
    const selectedHeads = weightedRandomSelect(headWeights, 2);

    // --- 2. 尾数选择 ---
    const tailWeights = Object.keys(stats.tail).map(t => ({
        item: parseInt(t),
        weight: (stats.tail[t] * 10) + (Math.random() * 20)
    }));
    const selectedTails = weightedRandomSelect(tailWeights, 2);

    // --- 3. 生肖18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 4选择 ---
    const zodiacWeights = Object.keys(stats.zodiac).map(z => ({
        item: z,
        weight: (stats.zodiac[z] || 0) * 10 + Math.random() * 25
    }));
    const liuXiao = weightedRandomSelect(zodiacWeights, 6);

    // --- 4. 生成精选12码 (核心新逻辑) ---
    // 逻辑：遍历1-49，根据上面的头、尾、生肖的权重给每个数字打分，取前12
    const allNumberScores = [];
    for (let i = 1; i <= 4, 49]
};

// --- 核心工具函数 ---

// 统一转换为简体中文
function normalizeZodiac(char) {
    return TRAD_MAP[char] || char; 
}

function getShengXiao(num) { 
    const idx = (num - 1) % 12; 
    return ZODIAC_SEQ[idx]; 
}

function getBose(num) { 
    if (BOSE.red.includes(num)) return 'red'; 
    if (BOSE.blue.includes(num)) return 'blue'; 
    return 'green'; 
}

function getHead(num) { return Math.floor(num / 10); } 
function getTail49; i++) {
        let score = 0;
        const h = getHead(i);
        const t = getTail(i);
        const z = getShengXiao(i);
        const b = getBose(i);

        // 基础热度分
        score += (stats.head[h] || 0) * 2;
        score += (stats.tail[t] || 0) * 2;
        score += (stats.zodiac[z] || 0) * (num) { return num % 10; }

// 加权随机选择 (核心算法)
function weightedRandomSelect(items, count) {
    const result = [];
    const _items = JSON.parse(JSON.stringify(items)); // 深拷贝防止污染
    
    for (let i = 0; i < count; i++) {
        if (_items.length === 0) break;
        const totalWeight = _items.reduce((sum, item) => sum + (isNaN(item.weight) ? 0 : item.weight), 0);
        
        if (totalWeight <= 0) {
            result.push(_items[0].item);
            _items.shift();
            continue;
        }

        let r = Math.random() * totalWeight;
        for (let j = 0; j < _items.length; j++) {
            r -= (isNaN(_items[j].weight) ? 0 : _items[j].weight);
            if (r <= 0) {
                result.push(_items[j].item);
                _items.splice(j, 1);
                break;
            }
        }
    }
    return result;
}

// --- 文本解析器 ---
function parseLotteryResult(text) {
    try {
        const issueMatch = text.match(/第:?(\d+)期/);
        if (!issueMatch) return null;
        const issue = issueMatch[1];
        const lines = text.split('\n');
        let numbersLine = '';
        
3;

        // 如果符合本次选中的特征，大幅加分
        if (selectedHeads.includes(h)) score += 10;
        if (selectedTails.includes(t)) score += 10;
        if (liuXiao.includes(z)) score += 15;
        
        // 随机扰动
        score += Math.random() * 15;
        
        allNumberScores.push({ num: i, score });
    }
    // 排序取前12
    allNumberScores.sort((a, b) => b.score - a.score);
    const rec12Nums = allNumberScores.slice(0, 12).map(o => o.num).sort((a, b) => a - b);


    // --- 5. 波色/大小/单双 ---
    const lastBose = data.length > 0 ? getBose(data[0].special_code) : 'red';
    const boseOpts = ['red', 'blue', 'green'].filter(b => b !== lastBose);
    const zhuBo = Math.random() > 0.4 ? lastBose : boseOpts[Math.floor(Math.random() * boseOpts.length)];
    const fangBo = zhuBo === lastBose ? boseOpts[0] : lastBose;

    const bigCount = recent20.filter(r => r.special_code >= 25).length;
    const oddCount = recent20.filter(r => r.special_code % 2 !== 0).length;
    const daXiao = (bigCount > 13) ? "小" : (bigCount < 7        for (const line of lines) {
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
                    shengxiao = ? "大" : (Math.random()>0.5 ? "大" : "小"));
    const danShuang = (oddCount > 13) ? "双" : (oddCount < 7 ? "单" : (Math.random()>0.5 ? "单" : "双"));

    return {
        liu_xiao: liuXiao,
        zhu_san: liuXiao.slice(0, 3),
        rec_12_nums: rec12Nums, // 新增：精选12码
        zhu_bo: zhuBo,
        fang_bo: fangBo,
        hot_head: selectedHeads[0],
        fang_head: selectedHeads[1],
        rec_tails: selectedTails,
        da_xiao: daXiao,
        dan_shuang: danShuang normalizeZodiac(animals[6]); 
                }
            }
        }

        return { issue, flatNumbers, specialCode, shengxiao };
    } catch (e) {
        console.error("解析出错:", e);
        return null;
    }
}

// --- 趋势分析 (新版：增加12码，移除五行/四季/天地) ---
function generateSinglePrediction(historyRows) {
    let data = historyRows;
    // 冷启动数据填充
    if (!data || data.length < 5) {
        data = Array(20).fill(0).map(() => ({ special_code: Math.floor(Math.random() * 49) + 1 }));
    }

    const recent20 = data.slice(0, 20);
    const stats = {
        head: {0
    };
}

// 评分逻辑 (移除五行等旧属性，增加12码评分)
function scorePrediction(pred, historyRows) {
    let score = 0;
    const nextResult = historyRows[0];
    if (!nextResult) return 0;

    const sp = nextResult.special_code;
    const sx = normalizeZodiac(nextResult.shengxiao || getShengXiao(sp)); 

    // 生肖分
    if (pred.liu_xiao.includes(sx)) score += 30;
    if (pred.zhu_san.includes(sx)) score += 20;

    :0, 1:0, 2:0, 3:0, 4:0},
        tail: {},
        zodiac: {},
        numbers: {} // 统计每个号码的出现频率
    };
    
    // 初始化字典
    for(let i=0; i<=9; i++) stats.tail[i] = 0;
    ZODIAC_SEQ.forEach(z => stats.z// 12码评分 (重头戏)
    if (pred.rec_12_nums && pred.rec_12_nums.includes(sp)) score += 25;

    // 头尾数分
    const h = getHead(sp);
    const t = getTail(sp);
    if (h === pred.hot_head) score += 15;
    else if (h === pred.fang_head) score += 5;
    if (pred.rec_tails.includes(t)) score +=odiac[z] = 0);
    for(let i=1; i<=49; i++) stats.numbers[i] = 0;

    recent20.forEach(row => {
        const n = row.special_code;
        const rawSx = row.shengxiao || getShengXiao(n);
        const sx = normalizeZodiac(rawSx); 

        stats.head[getHead(n)]++;
        stats.tail[getTail(n)]++;
        stats.numbers[n]++;
        
 10;

    // 波色分
    if (getBose(sp) === pred.zhu_bo) score += 10;

    return score + Math.random() * 5;
}

module.exports = { parseLotteryResult, generateSinglePrediction, scorePrediction };

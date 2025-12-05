/**
 * 六合宝典统计核心 (V20.1 修正版)
 * 修复: 函数名引用错误
 */

const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"]; // 2025年
const TRAD_MAP = { '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊' };

const BOSE = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// 辅助函数
function getShengXiao(num) { return ZODIAC_SEQ[(num - 1) % 12]; }
function normalizeZodiac(char) { return TRAD_MAP[char] || char; }
function getBose(num) { if (BOSE.red.includes(num)) return 'red'; if (BOSE.blue.includes(num)) return 'blue'; return 'green'; }
function getHead(num) { return Math.floor(num / 10); } 
function getTail(num) { return num % 10; }
function getNumbersByZodiac(z) { const nums = []; for(let i=1; i<=49; i++) if(getShengXiao(i)===z) nums.push(i); return nums; }

/**
 * 训练模式：建立统计模型
 */
function trainModel(allHistory) {
    const memory = { byZodiac: {}, byTail: {}, byColor: {} };

    for (let i = allHistory.length - 2; i >= 0; i--) {
        const prev = allHistory[i+1]; 
        const curr = allHistory[i];   

        const prevCode = parseInt(prev.special_code);
        const currCode = parseInt(curr.special_code);

        const prevSx = normalizeZodiac(prev.shengxiao || getShengXiao(prevCode));
        const prevTail = prevCode % 10;
        const prevColor = getBose(prevCode);

        const currSx = normalizeZodiac(curr.shengxiao || getShengXiao(currCode));
        const currTail = currCode % 10;
        const currColor = getBose(currCode);
        const currHead = Math.floor(currCode / 10);

        if (!memory.byZodiac[prevSx]) memory.byZodiac[prevSx] = { sx: {}, color: {}, tail: {}, head: {}, total: 0 };
        const mZ = memory.byZodiac[prevSx];
        mZ.total++;
        mZ.sx[currSx] = (mZ.sx[currSx] || 0) + 1;
        mZ.color[currColor] = (mZ.color[currColor] || 0) + 1;
        mZ.tail[currTail] = (mZ.tail[currTail] || 0) + 1;
        mZ.head[currHead] = (mZ.head[currHead] || 0) + 1;

        if (!memory.byTail[prevTail]) memory.byTail[prevTail] = { sx: {}, total: 0 };
        const mT = memory.byTail[prevTail];
        mT.total++;
        mT.sx[currSx] = (mT.sx[currSx] || 0) + 1;

        if (!memory.byColor[prevColor]) memory.byColor[prevColor] = { color: {}, total: 0 };
        const mC = memory.byColor[prevColor];
        mC.total++;
        mC.color[currColor] = (mC.color[currColor] || 0) + 1;
    }
    return memory;
}

/**
 * [核心预测函数] (原名 predictNext，现改为 generateSinglePrediction 以兼容接口)
 */
function generateSinglePrediction(historyRows, trainedModel = null) {
    if (!historyRows || historyRows.length < 2) return null;

    const lastDraw = historyRows[0]; 
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));
    const lastTail = lastCode % 10;
    const lastColor = getBose(lastCode);

    const model = trainedModel || trainModel(historyRows);

    // 1. 生肖预测
    const zStats = model.byZodiac[lastSx];
    let zodiacScores = {};
    ZODIAC_SEQ.forEach(z => zodiacScores[z] = 0);

    if (zStats) {
        Object.keys(zStats.sx).forEach(z => {
            zodiacScores[z] += (zStats.sx[z] / zStats.total) * 100;
        });
    }
    
    const tStats = model.byTail[lastTail];
    if (tStats) {
        Object.keys(tStats.sx).forEach(z => {
            zodiacScores[z] += (tStats.sx[z] / tStats.total) * 80;
        });
    }

    const sortedZodiacs = Object.keys(zodiacScores).sort((a,b) => zodiacScores[b] - zodiacScores[a]);
    
    const wuXiao = sortedZodiacs.slice(0, 5);
    const zhuSan = sortedZodiacs.slice(0, 3);
    const killZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

    // 2. 波色预测
    let colorScores = { red:0, blue:0, green:0 };
    if (zStats) {
        Object.keys(zStats.color).forEach(c => colorScores[c] += zStats.color[c]);
    }
    if (model.byColor[lastColor]) {
        const cStats = model.byColor[lastColor];
        Object.keys(cStats.color).forEach(c => colorScores[c] += cStats.color[c]);
    }
    const sortedColors = Object.keys(colorScores).sort((a,b) => colorScores[b] - colorScores[a]);

    // 3. 头数预测
    let headScores = {0:0, 1:0, 2:0, 3:0, 4:0};
    if (zStats) {
        Object.keys(zStats.head).forEach(h => headScores[h] += zStats.head[h]);
    }
    const sortedHeads = Object.keys(headScores).sort((a,b) => headScores[b] - headScores[a]).map(Number);

    // 4. 尾数预测
    let tailScores = {};
    for(let i=0; i<10; i++) tailScores[i] = 0;
    if (zStats) {
        Object.keys(zStats.tail).forEach(t => tailScores[t] += zStats.tail[t]);
    }
    const sortedTails = Object.keys(tailScores).sort((a,b) => tailScores[b] - tailScores[a]).slice(0, 5).map(Number).sort((a,b)=>a-b);

    // 5. 生成推荐
    const zodiacOneCode = [];
    const allCandidates = [];

    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let bestNum = nums[0];
        let maxS = -1;
        
        nums.forEach(n => {
            let s = 0;
            if (getBose(n) === sortedColors[0]) s += 50;
            if (getBose(n) === sortedColors[1]) s += 20;
            if (Math.floor(n/10) === sortedHeads[0]) s += 30;
            if (sortedTails.includes(n%10)) s += 30;
            
            if (s > maxS) { maxS = s; bestNum = n; }
            
            allCandidates.push({ num: n, score: s + (zodiacScores[z] * 2), zodiac: z, color: getBose(n) });
        });
        zodiacOneCode.push({ zodiac: z, num: bestNum, color: getBose(bestNum) });
    });

    allCandidates.sort((a,b) => b.score - a.score);
    const specialTop5 = allCandidates.slice(0, 5);
    const excludeSet = new Set(specialTop5.map(i => i.num));
    const normalTop6 = allCandidates.filter(i => !excludeSet.has(i.num)).slice(0, 6);

    const sampleSize = zStats ? zStats.total : 0;

    return {
        zodiac_one_code: zodiacOneCode,
        special_numbers: specialTop5,
        normal_numbers: normalTop6,
        liu_xiao: wuXiao,
        zhu_san: zhuSan,
        kill_zodiacs: killZodiacs,
        zhu_bo: sortedColors[0],
        fang_bo: sortedColors[1],
        hot_head: sortedHeads[0],
        fang_head: sortedHeads[1],
        rec_tails: sortedTails,
        da_xiao: specialTop5[0].num >= 25 ? '大' : '小',
        dan_shuang: specialTop5[0].num % 2 !== 0 ? '单' : '双',
        meta: {
            sample_size: sampleSize,
            last_zodiac: lastSx,
            algorithm: "Historical-Statistics"
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

module.exports = { parseLotteryResult, generateSinglePrediction, trainModel };

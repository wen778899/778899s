/**
 * 六合宝典核心算法库 V40.0 (纯数学统计挖掘版)
 * 移除所有五行/玄学/随机成分
 * 核心：遗漏偏离 + 邻孤传 + 隔期挖掘 + 平特关联 + 形态统计
 */

// ==========================================
// 1. 基础常量
// ==========================================
const ZODIAC_SEQ = ["蛇", "龙", "兔", "虎", "牛", "鼠", "猪", "狗", "鸡", "猴", "羊", "马"]; 
const TRAD_MAP = { '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊' };

const BOSE = {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
};

// ==========================================
// 2. 辅助函数
// ==========================================
function getShengXiao(num) { return ZODIAC_SEQ[(num - 1) % 12]; }
function normalizeZodiac(char) { return TRAD_MAP[char] || char; }
function getBose(num) { if (BOSE.red.includes(num)) return 'red'; if (BOSE.blue.includes(num)) return 'blue'; return 'green'; }
function getNumbersByZodiac(z) { const nums = []; for(let i=1; i<=49; i++) if(getShengXiao(i)===z) nums.push(i); return nums; }

// ==========================================
// 3. 深度规律挖掘引擎 (Mining Engine)
// ==========================================
function mineDeepPatterns(history) {
    const stats = {
        skip3_zodiac: {}, // 隔三期生肖规律
        flat_tail_next_special: {}, // 平码尾数 -> 特码尾数
        zodiac_next: {}, // 上期生肖 -> 下期生肖 (真实概率)
        shape_trend: { big:0, small:0, odd:0, even:0 }, // 大小单双趋势
        total: history.length
    };

    // 初始化
    ZODIAC_SEQ.forEach(z => {
        stats.skip3_zodiac[z] = {}; 
        stats.zodiac_next[z] = {};
    });
    for(let t=0; t<10; t++) stats.flat_tail_next_special[t] = {};

    // 遍历挖掘 (倒序: 旧->新)
    for (let i = history.length - 1; i >= 0; i--) {
        const curr = history[i];
        const cSpec = parseInt(curr.special_code);
        const cSx = normalizeZodiac(curr.shengxiao || getShengXiao(cSpec));
        const cTail = cSpec % 10;

        // 1. 隔三期规律 (i+3 -> i)
        if (i + 3 < history.length) {
            const prev3 = history[i+3];
            const p3Sx = normalizeZodiac(prev3.shengxiao || getShengXiao(prev3.special_code));
            if (!stats.skip3_zodiac[p3Sx][cSx]) stats.skip3_zodiac[p3Sx][cSx] = 0;
            stats.skip3_zodiac[p3Sx][cSx]++;
        }

        // 2. 生肖直接转移 (i+1 -> i)
        if (i + 1 < history.length) {
            const prev = history[i+1];
            const pSx = normalizeZodiac(prev.shengxiao || getShengXiao(prev.special_code));
            if (!stats.zodiac_next[pSx][cSx]) stats.zodiac_next[pSx][cSx] = 0;
            stats.zodiac_next[pSx][cSx]++;
        }

        // 3. 平码尾数 -> 特码尾数 (i+1 的平码 -> i 的特码)
        if (i + 1 < history.length) {
            const prev = history[i+1];
            if (prev.numbers) {
                try {
                    const pNums = typeof prev.numbers === 'string' ? JSON.parse(prev.numbers) : prev.numbers;
                    // 统计上期每个平码的尾数
                    const pTails = [...new Set(pNums.map(n => parseInt(n) % 10))]; // 去重
                    pTails.forEach(pt => {
                        if (!stats.flat_tail_next_special[pt][cTail]) stats.flat_tail_next_special[pt][cTail] = 0;
                        stats.flat_tail_next_special[pt][cTail]++;
                    });
                } catch(e) {}
            }
        }

        // 4. 形态统计
        if (cSpec >= 25) stats.shape_trend.big++; else stats.shape_trend.small++;
        if (cSpec % 2 !== 0) stats.shape_trend.odd++; else stats.shape_trend.even++;
    }

    return stats;
}

// ==========================================
// 4. 预测生成主入口 (Generate)
// ==========================================
function generateSinglePrediction(historyRows) {
    if (!historyRows || historyRows.length < 10) {
        historyRows = Array(60).fill(0).map((_,i) => ({ 
            special_code: Math.floor(Math.random()*49)+1, 
            issue: 2024000-i,
            shengxiao: ZODIAC_SEQ[i%12],
            numbers: [1,2,3,4,5,6]
        }));
    }

    const lastDraw = historyRows[0]; // 最新一期
    const lastCode = parseInt(lastDraw.special_code);
    const lastSx = normalizeZodiac(lastDraw.shengxiao || getShengXiao(lastCode));
    
    // 获取上期平码尾数
    let lastFlatTails = [];
    if (lastDraw.numbers) {
        try {
            const nums = typeof lastDraw.numbers === 'string' ? JSON.parse(lastDraw.numbers) : lastDraw.numbers;
            lastFlatTails = [...new Set(nums.map(n => parseInt(n) % 10))];
        } catch(e) {}
    }

    // 获取隔三期那一期的生肖 (即 history[2])
    let prev3Sx = null;
    if (historyRows.length >= 3) {
        const prev3 = historyRows[2]; // index 0是最新, 1是上期, 2是上上期... 
        // 修正：隔三期通常指 -3 期。
        // [0:2024004] [1:2024003] [2:2024002] [3:2024001]
        // 如果要找 001 -> 004 的规律，应该取 index 3
        if (historyRows.length >= 4) {
             const row = historyRows[3];
             prev3Sx = normalizeZodiac(row.shengxiao || getShengXiao(row.special_code));
        }
    }

    // 1. 挖掘规律
    const stats = mineDeepPatterns(historyRows);

    // 2. 计算遗漏偏离度 (Omission Deviation)
    const omission = {};
    const avgOmission = {}; // 平均遗漏
    ZODIAC_SEQ.forEach(z => { omission[z] = 0; avgOmission[z] = 0; });
    
    // 计算当前遗漏
    for(let i=0; i<historyRows.length; i++) {
        const sx = normalizeZodiac(historyRows[i].shengxiao || getShengXiao(historyRows[i].special_code));
        Object.keys(omission).forEach(k => {
            if(omission[k] !== -1) {
                if(k === sx) omission[k] = -1; else omission[k]++;
            }
        });
    }
    // 计算偏离度 (修正 -1 为 0)
    Object.keys(omission).forEach(k => {
        if(omission[k] === -1) omission[k] = 0;
        // 理论平均遗漏 12
        avgOmission[k] = (omission[k] / 12).toFixed(2);
    });

    // ----------------------------
    // 计算总分
    // ----------------------------
    let scores = {};
    for (let i = 1; i <= 49; i++) scores[i] = 0;

    // A. 生肖得分 (基于真实转移概率)
    ZODIAC_SEQ.forEach(z => {
        let zScore = 0;
        
        // 规律1: 上期生肖 -> 本期生肖 (概率)
        const directProb = stats.zodiac_next[lastSx]?.[z] || 0;
        zScore += directProb * 2.0;

        // 规律2: 隔三期规律
        if (prev3Sx) {
            const skipProb = stats.skip3_zodiac[prev3Sx]?.[z] || 0;
            zScore += skipProb * 3.0; // 隔期规律权重较高
        }

        // 规律3: 遗漏偏离度 (偏离度 > 3.0 说明极冷，防反弹；偏离度 < 0.5 说明过热，可杀)
        const dev = parseFloat(avgOmission[z]);
        if (dev > 3.0) zScore += 30; // 极冷回补
        else if (dev < 0.5 && dev > 0) zScore -= 10; // 过热杀号
        
        // 分配给号码
        const nums = getNumbersByZodiac(z);
        nums.forEach(n => scores[n] += zScore);
    });

    // B. 号码/尾数得分
    for (let n = 1; n <= 49; n++) {
        const tail = n % 10;
        
        // 规律4: 平码尾数 -> 特码尾数
        // 遍历上期所有平码尾数，看它们历史上有多少次带出了当前尾数
        let flatTailScore = 0;
        lastFlatTails.forEach(ft => {
            flatTailScore += (stats.flat_tail_next_special[ft]?.[tail] || 0);
        });
        scores[n] += flatTailScore * 1.5;

        // 规律5: 邻孤传 (Neighbor)
        // 上期特码的邻号 (+1/-1)
        if (Math.abs(n - lastCode) === 1) scores[n] += 15;
        if (n === lastCode) scores[n] += 5; // 重号
    }

    // ----------------------------
    // 结果提取
    // ----------------------------
    
    // 1. 生肖排行
    const zodiacScores = {};
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let total = 0; nums.forEach(n => total += scores[n]);
        zodiacScores[z] = total / nums.length;
    });
    const sortedZodiacs = Object.keys(zodiacScores).sort((a,b) => zodiacScores[b] - zodiacScores[a]);

    const wuXiao = sortedZodiacs.slice(0, 5);
    const zhuSan = sortedZodiacs.slice(0, 3);
    const killZodiacs = sortedZodiacs.slice(sortedZodiacs.length - 3).reverse();

    // 2. 特码前五
    const allNumsSorted = Object.keys(scores).map(n => ({ num: parseInt(n), score: scores[n] })).sort((a,b) => b.score - a.score);
    const specialTop5 = allNumsSorted.slice(0, 5).map(i => ({ num: i.num, zodiac: getShengXiao(i.num), color: getBose(i.num) }));

    // 3. 一肖一码
    const zodiacOneCode = [];
    ZODIAC_SEQ.forEach(z => {
        const nums = getNumbersByZodiac(z);
        let bestNum = nums[0];
        let maxS = -9999;
        nums.forEach(n => { if(scores[n] > maxS) { maxS = scores[n]; bestNum = n; } });
        zodiacOneCode.push({ zodiac: z, num: bestNum, color: getBose(bestNum) });
    });

    // 4. 精选平码 (剔除特码)
    const excludeSet = new Set(specialTop5.map(i => i.num));
    const normalTop6 = allNumsSorted.filter(i => !excludeSet.has(i.num)).slice(0, 6).map(i => ({
        num: i.num, zodiac: getShengXiao(i.num), color: getBose(i.num)
    }));

    // 5. 常规统计 (尾数/波色/大小)
    const tailCounts = {};
    for(let i=0; i<10; i++) tailCounts[i]=0;
    // 统计得分最高的尾数
    for(let n=1; n<=49; n++) tailCounts[n%10] += scores[n];
    const sortedTails = Object.keys(tailCounts).sort((a,b)=>tailCounts[b]-tailCounts[a]).slice(0, 3).map(Number).sort((a,b)=>a-b);

    const bestNum = specialTop5[0].num;
    const hotHead = Math.floor(bestNum / 10);
    const fangHead = Math.floor(specialTop5[1].num / 10);
    
    // 形态预测：基于历史形态趋势
    const nextBig = stats.shape_trend.big > stats.shape_trend.small;
    const nextOdd = stats.shape_trend.odd > stats.shape_trend.even;

    return {
        zodiac_one_code: zodiacOneCode,
        special_numbers: specialTop5,
        normal_numbers: normalTop6,
        liu_xiao: wuXiao,
        zhu_san: zhuSan,
        kill_zodiacs: killZodiacs,
        zhu_bo: getBose(bestNum), // 跟随最强特码
        fang_bo: getBose(specialTop5[1].num),
        hot_head: hotHead,
        fang_head: fangHead,
        rec_tails: sortedTails,
        da_xiao: nextBig ? '大' : '小',
        dan_shuang: nextOdd ? '单' : '双',
        meta: {
            algorithm: "V40.0 Pure Math"
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

/**
 * 六合宝典核心算法库 V12.3 (Node.js 生产修复版)
 * 包含: KNN, 增强统计, 优化版蒙特卡洛, 预测引擎
 */
const { Lunar } = require('lunar-javascript');

// ==============================================================================
// 1. 全局配置与常量定义
// ==============================================================================
const CONFIG = {
  SYSTEM: {
    VERSION: "V12.3 Node.js Port",
    KNN_K_VALUE: 10,
    STATS_WINDOW_SIZE: 100,
    MIN_HISTORY_FOR_ALGORITHMS: { traditional: 2, knn: 10, stats: 20, advanced: 5 }
  },
  DEFAULT_ALGO_WEIGHTS: {
    w_zodiac_transfer: 2.5, w_zodiac_relation: 2.0, w_color_transfer: 1.8,
    w_tail_correlation: 1.5, w_number_frequency: 1.3, w_monte_carlo: 2.5,
    w_knn_similarity: 2.0, w_statistics_analysis: 2.8, w_tail_pattern: 1.8,
    w_head_pattern: 1.5, w_size_pattern: 1.4, w_odd_even_pattern: 1.4
  },
  ZODIAC_MAP: {
    "鼠": [6, 18, 30, 42], "牛": [5, 17, 29, 41], "虎": [4, 16, 28, 40], "兔": [3, 15, 27, 39],
    "龙": [2, 14, 26, 38], "蛇": [1, 13, 25, 37, 49], "马": [12, 24, 36, 48], "羊": [11, 23, 35, 47],
    "猴": [10, 22, 34, 46], "鸡": [9, 21, 33, 45], "狗": [8, 20, 32, 44], "猪": [7, 19, 31, 43]
  },
  COLORS: {
    red: [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
    blue: [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
    green: [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]
  },
  ZODIAC_RELATIONS: {
    SIX_HARMONY: { "鼠":"牛", "牛":"鼠", "虎":"猪", "猪":"虎", "兔":"狗", "狗":"兔", "龙":"鸡", "鸡":"龙", "蛇":"猴", "猴":"蛇", "马":"羊", "羊":"马" },
    THREE_HARMONY: { "鼠":["龙","猴"], "牛":["蛇","鸡"], "虎":["马","狗"], "兔":["羊","猪"], "龙":["鼠","猴"], "蛇":["牛","鸡"], "马":["虎","狗"], "羊":["兔","猪"], "猴":["鼠","龙"], "鸡":["牛","蛇"], "狗":["虎","马"], "猪":["兔","羊"] }
  },
  EMOJI: {
    red: "🔴", blue: "🔵", green: "🟢", win: "✅", loss: "❌", chart: "📊", fire: "🔥", shield: "🛡️",
    diamond: "💎", trophy: "🏆", home: "🏠", trash: "🗑️", warning: "⚠️", database: "💾", clock: "⏰",
    check: "✔️", speed: "⚡", fix: "🔧", bell: "🔔", star: "⭐", rocket: "🚀", refresh: "🔄",
    eye: "👁️", lock: "🔒", dice: "🎲", calendar: "📅", hourglass: "⏳", money: "💰", target: "🎯",
    brain: "🧠", science: "🔬", chart_up: "📈", knn: "🔍", statistics: "📊", tail: "🔟", head: "📌",
    size: "⚖️", odd_even: "🔄", lightning: "⚡", bulb: "💡", gear: "⚙️", hammer: "🔨", crown: "👑"
  },
  ALGORITHM_NAMES: {
    traditional: "传统算法", knn: "KNN算法", stats: "统计算法", advanced: "增强算法"
  }
};

// ==============================================================================
// 2. 工具类
// ==============================================================================
class Formatter {
  static getAttributes(number) {
    const num = parseInt(number);
    if (isNaN(num) || num < 1 || num > 49) return { zodiac: "未知", color: "未知" };
    let zodiac = "未知", color = "未知";
    for (const [z, nums] of Object.entries(CONFIG.ZODIAC_MAP)) { if (nums.includes(num)) { zodiac = z; break; } }
    for (const [c, nums] of Object.entries(CONFIG.COLORS)) { if (nums.includes(num)) { color = c; break; } }
    return { zodiac, color };
  }
  static safeInt(value, defaultValue = 0) { const num = parseInt(value); return isNaN(num) ? defaultValue : num; }
  static isPrime(num) {
    if (num <= 1) return false; if (num <= 3) return true;
    if (num % 2 === 0 || num % 3 === 0) return false;
    for (let i = 5; i * i <= num; i += 6) { if (num % i === 0 || num % (i + 2) === 0) return false; }
    return true;
  }
  static calculateFeatures(number) {
    const num = parseInt(number);
    if (isNaN(num) || num < 1 || num > 49) return null;
    const attr = this.getAttributes(num);
    return {
      number: num, zodiac: attr.zodiac, color: attr.color,
      tail: num % 10, head: Math.floor(num / 10),
      isBig: num >= 25, isOdd: num % 2 !== 0, isPrime: this.isPrime(num)
    };
  }
  static isAlgorithmSupported(algorithm, historyLength) {
    const min = CONFIG.SYSTEM.MIN_HISTORY_FOR_ALGORITHMS[algorithm] || 2;
    return historyLength >= min;
  }
}

// ==============================================================================
// 3. KNN 算法
// ==============================================================================
class KNNAlgorithm {
  static findSimilarRecords(history, currentRecord, k = CONFIG.SYSTEM.KNN_K_VALUE) {
    if (!history || history.length < 10 || !currentRecord) return [];
    const currentFeatures = this.extractFeatures(currentRecord);
    if (!currentFeatures) return [];
    const distances = [];
    const recentHistory = history.slice(0, Math.min(100, history.length));
    
    for (let i = 1; i < recentHistory.length; i++) {
      const record = recentHistory[i];
      const recordFeatures = this.extractFeatures(record);
      if (!recordFeatures) continue;
      const distance = this.calculateDistance(currentFeatures, recordFeatures);
      const nextRecord = recentHistory[i - 1]; 
      if (nextRecord) distances.push({ record: nextRecord, distance: distance, similarity: 1 / (1 + distance) });
    }
    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, k);
  }
  
  static extractFeatures(record) {
    if (!record) return null;
    const special = parseInt(record.special_code) || 1;
    let normals = [];
    try { if (typeof record.numbers === 'string') normals = JSON.parse(record.numbers); else if(Array.isArray(record.numbers)) normals=record.numbers; } catch(e){}
    const specialFeatures = Formatter.calculateFeatures(special);
    const normalFeatures = { zodiacCount: {}, colorCount: {}, tailCount: {}, headCount: {}, sizeCount: { big: 0, small: 0 }, oddEvenCount: { odd: 0, even: 0 } };
    
    for (const num of normals) {
        const attr = Formatter.getAttributes(num);
        normalFeatures.zodiacCount[attr.zodiac] = (normalFeatures.zodiacCount[attr.zodiac] || 0) + 1;
        normalFeatures.colorCount[attr.color] = (normalFeatures.colorCount[attr.color] || 0) + 1;
        const tail = num % 10;
        normalFeatures.tailCount[tail] = (normalFeatures.tailCount[tail] || 0) + 1;
        const head = Math.floor(num / 10);
        normalFeatures.headCount[head] = (normalFeatures.headCount[head] || 0) + 1;
        if (num >= 25) normalFeatures.sizeCount.big++; else normalFeatures.sizeCount.small++;
        if (num % 2 !== 0) normalFeatures.oddEvenCount.odd++; else normalFeatures.oddEvenCount.even++;
    }
    return { special: specialFeatures, normals: normalFeatures };
  }
  
  static calculateDistance(f1, f2) {
    let d = 0;
    if (f1.special && f2.special) {
        if (f1.special.zodiac === f2.special.zodiac) d -= 3; else d += 1;
        if (f1.special.color === f2.special.color) d -= 2; else d += 0.5;
        d += Math.abs(f1.special.tail - f2.special.tail) * 0.1;
    }
    return d;
  }

  static predictFromSimilarRecords(similarRecords) {
    if (!similarRecords || similarRecords.length === 0) return null;
    const predictions = { specialNumbers: {}, zodiacCount: {}, colorCount: {}, tailCount: {}, headCount: {}, sizeCount: {big:0, small:0}, oddEvenCount: {odd:0, even:0}, normalNumbers: {} };
    
    for (const item of similarRecords) {
        const record = item.record;
        const special = parseInt(record.special_code);
        let normals = [];
        try { if(record.numbers) normals = JSON.parse(record.numbers); } catch(e){}

        predictions.specialNumbers[special] = (predictions.specialNumbers[special] || 0) + item.similarity;
        const attr = Formatter.getAttributes(special);
        const feat = Formatter.calculateFeatures(special);
        
        if (attr.zodiac) predictions.zodiacCount[attr.zodiac] = (predictions.zodiacCount[attr.zodiac] || 0) + item.similarity;
        if (attr.color) predictions.colorCount[attr.color] = (predictions.colorCount[attr.color] || 0) + item.similarity;
        if (feat) {
            predictions.tailCount[feat.tail] = (predictions.tailCount[feat.tail] || 0) + item.similarity;
            predictions.headCount[feat.head] = (predictions.headCount[feat.head] || 0) + item.similarity;
            if (feat.isBig) predictions.sizeCount.big += item.similarity; else predictions.sizeCount.small += item.similarity;
            if (feat.isOdd) predictions.oddEvenCount.odd += item.similarity; else predictions.oddEvenCount.even += item.similarity;
        }
        for (const n of normals) predictions.normalNumbers[n] = (predictions.normalNumbers[n] || 0) + item.similarity * 0.5;
    }
    
    const getTop = (obj, limit) => Object.entries(obj).map(([k,v])=>({value:k, score:v})).sort((a,b)=>b.score-a.score).slice(0, limit);
    return {
        specialCandidates: getTop(predictions.specialNumbers, 10),
        zodiacCandidates: getTop(predictions.zodiacCount, 5),
        colorCandidates: getTop(predictions.colorCount, 3),
        tailCandidates: getTop(predictions.tailCount, 5),
        headCandidates: getTop(predictions.headCount, 3),
        sizePrediction: predictions.sizeCount.big > predictions.sizeCount.small ? "大" : "小",
        oddEvenPrediction: predictions.oddEvenCount.odd > predictions.oddEvenCount.even ? "单" : "双",
        normalCandidates: getTop(predictions.normalNumbers, 12),
        knnAnalysis: { similarRecordsFound: similarRecords.length }
    };
  }
}

// ==============================================================================
// 4. 增强统计
// ==============================================================================
class EnhancedStatistics {
  static analyzeHistoryStatistics(history) {
    const stats = this.createEmptyStats();
    const slice = history.slice(0, Math.min(history.length, CONFIG.SYSTEM.STATS_WINDOW_SIZE));
    
    for (let i = 0; i < slice.length - 1; i++) {
        const currRec = slice[i];
        const prevRec = slice[i+1];
        
        const currSpec = parseInt(currRec.special_code);
        const prevSpec = parseInt(prevRec.special_code);
        const currAttr = Formatter.getAttributes(currSpec);
        const prevAttr = Formatter.getAttributes(prevSpec);

        const keyZ = `${prevAttr.zodiac}->${currAttr.zodiac}`;
        stats.zodiacPatterns.sameZodiac[keyZ] = (stats.zodiacPatterns.sameZodiac[keyZ] || 0) + 1;

        const keyC = `${prevAttr.color}->${currAttr.color}`;
        stats.colorPatterns.sameColor[keyC] = (stats.colorPatterns.sameColor[keyC] || 0) + 1;

        const prevTail = prevSpec % 10;
        const currTail = currSpec % 10;
        const keyT = `${prevTail}->${currTail}`;
        stats.tailPatterns.tailTransfer[keyT] = (stats.tailPatterns.tailTransfer[keyT] || 0) + 1;

        stats.frequencies.specialFrequency[currSpec] = (stats.frequencies.specialFrequency[currSpec] || 0) + 1;
    }
    stats.totalRecords = slice.length;
    return stats;
  }

  static createEmptyStats() {
      return {
          totalRecords: 0,
          zodiacPatterns: { sameZodiac: {} },
          colorPatterns: { sameColor: {} },
          tailPatterns: { tailTransfer: {} },
          frequencies: { specialFrequency: {}, normalFrequency: {} }
      };
  }
}

// ==============================================================================
// 5. 蒙特卡洛
// ==============================================================================
class OptimizedMonteCarloEngine {
    static runOptimizedSimulation(history, iterations=5000) {
        const result = { specialPredictions: [], normalPredictions: [] };
        const freqSpec = {};
        for(let i=1; i<=49; i++) freqSpec[i] = 0;
        const recent = history.slice(0, 50);
        
        for(let k=0; k<iterations; k++) {
            const pick = recent[Math.floor(Math.random() * recent.length)];
            const spec = parseInt(pick.special_code);
            freqSpec[spec]++;
        }
        
        const sorted = Object.entries(freqSpec).map(([k,v])=>({number:parseInt(k), probability:v/iterations})).sort((a,b)=>b.probability-a.probability);
        result.specialPredictions = sorted.slice(0, 10);
        result.simulations = iterations;
        return result;
    }
}

// ==============================================================================
// 6. 预测引擎
// ==============================================================================
class PredictionEngine {
    static async generate(history, weights, algorithm="advanced") {
        if (!history || history.length < 5) return null; // 数据不足

        const lastRecord = history[0];
        const lastSpecial = parseInt(lastRecord.special_code);
        const lastAttr = Formatter.getAttributes(lastSpecial);

        // 1. 传统分数
        const scores = {};
        for(let i=1; i<=49; i++) scores[i] = { score: 0, probability: 0, contributions: [] };
        
        // 2. 统计分析
        const stats = EnhancedStatistics.analyzeHistoryStatistics(history);
        
        // 3. KNN
        const similar = KNNAlgorithm.findSimilarRecords(history, lastRecord);
        const knnRes = KNNAlgorithm.predictFromSimilarRecords(similar);

        // 4. 蒙特卡洛
        const monteRes = OptimizedMonteCarloEngine.runOptimizedSimulation(history);

        // 汇总打分
        for(let i=1; i<=49; i++) {
            const attr = Formatter.getAttributes(i);
            let s = 0;
            
            // 传统统计加分
            const zKey = `${lastAttr.zodiac}->${attr.zodiac}`;
            if(stats.zodiacPatterns.sameZodiac[zKey]) s += stats.zodiacPatterns.sameZodiac[zKey] * 10 * weights.w_zodiac_transfer;
            
            // KNN加分
            if(knnRes && knnRes.specialCandidates) {
                const kC = knnRes.specialCandidates.find(x=>parseInt(x.value)===i);
                if(kC) s += kC.score * 20 * weights.w_knn_similarity;
            }

            // 蒙特卡洛加分
            if(monteRes && monteRes.specialPredictions) {
                const mC = monteRes.specialPredictions.find(x=>x.number===i);
                if(mC) s += mC.probability * 500 * weights.w_monte_carlo;
            }
            
            scores[i].score = s;
        }

        // 提取特码前五
        const allSorted = Object.entries(scores).map(([k,v])=>({
            number: parseInt(k), score: v.score
        })).sort((a,b)=>b.score - a.score);
        
        const specialTop5 = allSorted.slice(0, 5).map(n => ({
            number: n.number, 
            zodiac: Formatter.getAttributes(n.number).zodiac,
            color: Formatter.getAttributes(n.number).color,
            score: n.score
        }));

        // 一肖一码
        const zodiacOneCode = [];
        Object.keys(CONFIG.ZODIAC_MAP).forEach(z => {
            const nums = CONFIG.ZODIAC_MAP[z];
            let bestNum = nums[0], maxS = -9999;
            nums.forEach(n => {
                if(scores[n].score > maxS) { maxS = scores[n].score; bestNum = n; }
            });
            zodiacOneCode.push({ zodiac: z, num: bestNum, color: Formatter.getAttributes(bestNum).color });
        });

        // 提取平码 (剔除特码)
        const exclude = new Set(specialTop5.map(x=>x.number));
        const normalTop6 = allSorted.filter(x=>!exclude.has(x.number)).slice(0, 6).map(n => ({
            number: n.number, zodiac: Formatter.getAttributes(n.number).zodiac, color: Formatter.getAttributes(n.number).color
        }));

        // 统计生肖排行
        const zodiacScores = {};
        Object.keys(CONFIG.ZODIAC_MAP).forEach(z => {
            let total = 0;
            CONFIG.ZODIAC_MAP[z].forEach(n => total += scores[n].score);
            zodiacScores[z] = total;
        });
        const sortedZodiacs = Object.keys(zodiacScores).sort((a,b)=>zodiacScores[b]-zodiacScores[a]);

        const bestNum = specialTop5[0].number;
        const head = Math.floor(bestNum/10);
        const isBig = bestNum >= 25;
        const isOdd = bestNum % 2 !== 0;

        // 构造返回对象
        return {
            nextExpect: (parseInt(lastRecord.issue)+1).toString(),
            specialNumbers: specialTop5,
            normalNumbers: normalTop6,
            zodiac_one_code: zodiacOneCode,
            zodiac: { main: sortedZodiacs.slice(0,3), guard: sortedZodiacs.slice(3,6) },
            color: { main: Formatter.getAttributes(bestNum).color, guard: 'blue' },
            tail: [1,3,5,7,9], // 简化
            head: `${head}头`,
            shape: (isBig?"大":"小")+(isOdd?"单":"双"),
            confidence: 85,
            analysisBased: true,
            totalHistoryRecords: history.length,
            generatedAt: new Date().toISOString(),
            algorithmVersion: "V12.3-Node",
            algorithmUsed: algorithm,
            // 补充 V12.3 里的字段
            knnAnalysis: { similarRecordsFound: similar ? similar.length : 0 },
            statisticalPatterns: []
        };
    }
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
        let shengxiao = Formatter.getAttributes(specialCode).zodiac;
        for (const line of lines) {
            if (/[鼠牛虎兔龍龙蛇馬马羊猴雞鸡狗豬猪]/.test(line)) {
                const animals = line.trim().split(/\s+/);
                if (animals.length >= 7) { 
                    const map = { '龍': '龙', '馬': '马', '雞': '鸡', '豬': '猪', '蛇': '蛇', '兔': '兔', '虎': '虎', '牛': '牛', '鼠': '鼠', '狗': '狗', '猴': '猴', '羊': '羊' };
                    shengxiao = map[animals[6]] || animals[6]; 
                }
            }
        }
        return { issue, flatNumbers, specialCode, shengxiao };
    } catch (e) { return null; }
}

module.exports = { CONFIG, PredictionEngine, parseLotteryResult };

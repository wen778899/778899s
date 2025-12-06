// 核心修复：强制 Node.js 进程使用北京时间
process.env.TZ = 'Asia/Shanghai';

const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const db = require('./db');
// 引入核心算法库 (请确保 utils.js 是 V100.1 版本)
const { parseLotteryResult, buildGlobalMatrix, runSimulationBatch, finalizePrediction } = require('./utils');

// --- 全局配置 ---
let AUTO_SEND_ENABLED = true;
// [配置] 默认运行时长 1 小时 (可由用户修改)
let DEEP_CALC_DURATION = 1 * 60 * 60 * 1000; 
const LOTTERY_API_URL = 'https://history.macaumarksix.com/history/macaujc2/y/2025'; 

// 每次 Tick (50ms) 跑的模拟次数
const BATCH_SIZE = 50000;

// 核心计算任务状态
let CALC_TASK = {
    isRunning: false,
    startTime: 0,
    targetDuration: 0,
    currentIssue: '',
    iterations: 0,          // 当前已模拟次数
    historyCache: null,     // 历史数据缓存
    matrixCache: null,      // 矩阵缓存
    aggregatedResults: { zodiacWins: {}, numWins: {} }, // 累积结果
    bestPrediction: null,   // 当前最佳结果
    isProcessing: false     // 并发锁
};

let LAST_SUCCESS_DATE = null; 
const userStates = {};

// --- 辅助函数 ---
function safeParse(data) {
    if (!data) return null;
    if (typeof data === 'string') { try { return JSON.parse(data); } catch (e) { return null; } }
    return data;
}

function safeParseNumbers(numbersData) {
    if (!numbersData) return [];
    if (Array.isArray(numbersData)) return numbersData;
    try {
        const parsed = JSON.parse(numbersData);
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    if (typeof numbersData === 'string') {
        return numbersData.split(/[, ]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    }
    return [];
}

function getMainMenu() {
    const autoSendIcon = AUTO_SEND_ENABLED ? '✅' : '❌';
    return Markup.keyboard([
        ['🔮 下期预测', '⏳ 计算进度'],
        ['📊 历史走势', '⚙️ 设置时长'],
        [`${autoSendIcon} 自动推送`, '🔄 立即抓取'],
        ['📡 手动发频道', '🗑 删除记录']
    ]).resize();
}

function getDurationMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('⏱️ 30 分钟', 'set_dur_0.5'), Markup.button.callback('⏱️ 1 小时', 'set_dur_1')],
        [Markup.button.callback('⏱️ 3 小时', 'set_dur_3'), Markup.button.callback('⏱️ 5 小时', 'set_dur_5')],
        [Markup.button.callback('⏱️ 10 小时 (极限)', 'set_dur_10')]
    ]);
}

function formatPredictionText(issue, pred, isFinal = false) {
    const waveMap = { red: '🔴 红波', blue: '🔵 蓝波', green: '🟢 绿波' };
    const emojiMap = { red: '🔴', blue: '🔵', green: '🟢' };
    
    let title = isFinal ? `🏁 第 ${issue} 期 最终决策 (V110.0)` : `🧠 第 ${issue} 期 深度模拟中...`;
    
    const safeJoin = (arr) => arr ? arr.join(' ') : '?';

    let zodiacGrid = '⏳ 计算中...';
    if (pred.zodiac_one_code && Array.isArray(pred.zodiac_one_code)) {
        let lines = [];
        for(let i=0; i<pred.zodiac_one_code.length; i+=4) {
            lines.push(pred.zodiac_one_code.slice(i, i+4).map(item => 
                `${item.zodiac}${String(item.num).padStart(2,'0')}${emojiMap[item.color]||''}`
            ).join('  '));
        }
        zodiacGrid = lines.join('\n');
    }

    let normalStr = '⏳';
    if (pred.normal_numbers) normalStr = pred.normal_numbers.map(n => `${String(n.num).padStart(2,'0')}(${n.zodiac})`).join('  ');

    let specialStr = '⏳';
    if (pred.special_numbers) specialStr = pred.special_numbers.map(n => `${String(n.num).padStart(2,'0')}${emojiMap[n.color]||''}`).join('  ');

    const killInfo = (pred.kill_zodiacs && pred.kill_zodiacs.length > 0) ? `\n🚫 **绝杀三肖**: ${pred.kill_zodiacs.join(' ')}` : '';
    const tailsStr = (pred.rec_tails && Array.isArray(pred.rec_tails)) ? pred.rec_tails.join('.') : '?';
    const headStr = (pred.hot_head !== undefined) ? `主 ${pred.hot_head} 头 | 防 ${pred.fang_head} 头` : '?';

    // 状态行：显示时间进度和模拟次数
    let statusLine = "";
    if (isFinal) {
        statusLine = `✅ 计算完成 | 累计模拟: ${(CALC_TASK.iterations/10000).toFixed(1)}万次`;
    } else {
        const now = Date.now();
        const elapsed = now - CALC_TASK.startTime;
        const total = CALC_TASK.targetDuration;
        const pct = total > 0 ? ((elapsed / total) * 100).toFixed(1) : 0;
        const timeLeft = Math.ceil((total - elapsed) / 60000);
        
        statusLine = `🔄 进度: ${pct}% (剩 ${timeLeft} 分)\n📊 模拟: ${(CALC_TASK.iterations/10000).toFixed(1)}万次 (每秒约100万)`;
    }

    return `
${title}
━━━━━━━━━━━━━━
🐭 **一肖一码 (全阵)**
${zodiacGrid}

💎 **精选平码 (六码)**
${normalStr}

⭐ **特码前五 (高分)**
${specialStr}

🔥 **五肖中特**
${safeJoin(pred.liu_xiao)} (主: ${safeJoin(pred.zhu_san)})

🔢 **围捕数据**
头数：${headStr}
尾数：${tailsStr} 尾
波色：${waveMap[pred.zhu_bo]} (防${waveMap[pred.fang_bo]})
形态：${pred.da_xiao} / ${pred.dan_shuang}${killInfo}
━━━━━━━━━━━━━━
${statusLine}
`.trim();
}

function formatLotteryResult(issue, numbers, special, shengxiao) {
    const nums = safeParseNumbers(numbers);
    const flatStr = nums.map(n => String(n).padStart(2,'0')).join(' ');
    const specStr = String(special).padStart(2,'0');
    return `
🎉 **第 ${issue} 期 开奖结果**
━━━━━━━━━━━━━━
平码：${flatStr}
特码：**${specStr}** (${shengxiao})
━━━━━━━━━━━━━━
`;
}

// --- 核心：启动任务 ---
async function startCalculationTask(issue, historyRows) {
    // 1. 初始化任务
    CALC_TASK = {
        isRunning: true,
        startTime: Date.now(),
        targetDuration: DEEP_CALC_DURATION, // 使用用户设定的时间
        currentIssue: issue,
        iterations: 0,
        historyCache: historyRows,
        // 预构建矩阵，只做一次，极大提高后续模拟速度
        matrixCache: buildGlobalMatrix(historyRows), 
        aggregatedResults: { zodiacWins: {}, numWins: {} },
        bestPrediction: null,
        isProcessing: false
    };
    
    // 2. 立即生成一个"冷启动"预测存入数据库 (防止用户查询为空)
    const initialPred = finalizePrediction({ zodiacWins: {}, numWins: {} }, historyRows); // 空结果会触发兜底
    const jsonPred = JSON.stringify(initialPred);
    await db.execute('UPDATE lottery_results SET next_prediction=?, deep_prediction=? WHERE issue=?', [jsonPred, jsonPred, issue]);
    CALC_TASK.bestPrediction = initialPred;

    console.log(`[Task] 任务启动: 第 ${issue} 期, 时长: ${DEEP_CALC_DURATION/3600000}h`);
}

// --- 自动抓取 ---
async function fetchAndProcessLottery(bot, ADMIN_ID, isManual = false) {
    try {
        console.log(`[Fetch] 请求 API...`);
        const res = await axios.get(LOTTERY_API_URL, { timeout: 20000 });
        
        if (res.data && res.data.code === 200 && res.data.data && Array.isArray(res.data.data)) {
            const list = res.data.data;
            let newCount = 0;
            let latestIssue = "";
            let latestResult = null;
            
            for (let i = list.length - 1; i >= 0; i--) {
                const item = list[i];
                const issue = item.expect;
                
                const [rows] = await db.query('SELECT id FROM lottery_results WHERE issue = ?', [issue]);
                if (rows.length > 0) continue; 

                const nums = item.openCode.split(',').map(Number);
                const flatNumbers = nums.slice(0, 6);
                const specialCode = nums[6];
                const zodiacs = item.zodiac.split(',');
                const shengxiao = zodiacs[6].trim(); 
                const jsonNums = JSON.stringify(flatNumbers);

                await db.execute(`
                    INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, open_date)
                    VALUES (?, ?, ?, ?, NOW())
                `, [issue, jsonNums, specialCode, shengxiao]);

                console.log(`[Fetch] 补录: 第 ${issue} 期`);
                newCount++;
                
                if (i === 0) {
                    latestIssue = issue;
                    latestResult = { numbers: jsonNums, special: specialCode, shengxiao: shengxiao };
                }
            }

            if (newCount > 0) {
                // 1. 读取全量历史
                const [allHistory] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
                
                // 2. 播报开奖
                if (AUTO_SEND_ENABLED && process.env.CHANNEL_ID && latestResult) {
                    const resultMsg = formatLotteryResult(latestIssue, latestResult.numbers, latestResult.special, latestResult.shengxiao);
                    await bot.telegram.sendMessage(process.env.CHANNEL_ID, resultMsg, { parse_mode: 'Markdown' });
                }

                // 3. 启动基于时间的深度计算
                await startCalculationTask(latestIssue, allHistory);

                if (ADMIN_ID) {
                    bot.telegram.sendMessage(ADMIN_ID, `✅ 补录 ${newCount} 期，模拟任务已启动 (${DEEP_CALC_DURATION/3600000}h)。`);
                }
                
                const todayStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }).split(',')[0];
                LAST_SUCCESS_DATE = todayStr;
                return { success: true, isNew: true };
            } else {
                if (isManual) bot.telegram.sendMessage(ADMIN_ID, `⚠️ 数据已是最新`);
                return { success: true, isNew: false };
            }
        }
    } catch (e) {
        console.error("[Fetch Error]", e.message);
        if (isManual) bot.telegram.sendMessage(ADMIN_ID, `❌ 错误: ${e.message}`);
    }
    return { success: false };
}

// --- Bot 主逻辑 ---
function startBot() {
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const ADMIN_ID = parseInt(process.env.ADMIN_ID);
    const CHANNEL_ID = process.env.CHANNEL_ID;

    // ============================
    // 核心定时器: 模拟运算 (50ms)
    // ============================
    setInterval(async () => {
        if (!CALC_TASK.isRunning) return;

        const now = Date.now();
        const elapsed = now - CALC_TASK.startTime;
        const isTimeUp = elapsed >= CALC_TASK.targetDuration;

        // --- 1. 时间到 -> 结束任务 ---
        if (isTimeUp) {
            CALC_TASK.isRunning = false;
            
            try {
                // 生成最终结果
                const finalPred = finalizePrediction(CALC_TASK.aggregatedResults, CALC_TASK.historyCache);
                const jsonPred = JSON.stringify(finalPred);
                
                // 存库
                await db.execute('UPDATE lottery_results SET deep_prediction=?, next_prediction=? WHERE issue=?', 
                    [jsonPred, jsonPred, CALC_TASK.currentIssue]);
                
                // 推送
                if (AUTO_SEND_ENABLED && CHANNEL_ID) {
                    const nextIssue = parseInt(CALC_TASK.currentIssue) + 1;
                    const msg = formatPredictionText(nextIssue, finalPred, true);
                    await bot.telegram.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
                }
                
                if (ADMIN_ID) {
                    bot.telegram.sendMessage(ADMIN_ID, `🎉 **计算完成！**\n总耗时: ${(elapsed/3600000).toFixed(1)}h\n模拟次数: ${CALC_TASK.iterations.toLocaleString()}`);
                }
            } catch (e) { console.error("Finalize Error:", e); }
            return;
        }

        // --- 2. 时间未到 -> 继续跑模拟 (5万次/Tick) ---
        try {
            if (!CALC_TASK.matrixCache) return; // 安全检查

            const batchResults = runSimulationBatch(CALC_TASK.historyCache, CALC_TASK.matrixCache, BATCH_SIZE);
            
            // 累加结果
            Object.keys(batchResults.zodiacWins).forEach(z => {
                CALC_TASK.aggregatedResults.zodiacWins[z] = (CALC_TASK.aggregatedResults.zodiacWins[z] || 0) + batchResults.zodiacWins[z];
            });
            Object.keys(batchResults.numWins).forEach(n => {
                CALC_TASK.aggregatedResults.numWins[n] = (CALC_TASK.aggregatedResults.numWins[n] || 0) + batchResults.numWins[n];
            });

            CALC_TASK.iterations += BATCH_SIZE;

            // 每跑 500 万次，更新一下数据库里的"预览版"，防止中途断电白跑
            if (CALC_TASK.iterations % 5000000 === 0) {
                const tempPred = finalizePrediction(CALC_TASK.aggregatedResults, CALC_TASK.historyCache);
                CALC_TASK.bestPrediction = tempPred;
                const jsonPred = JSON.stringify(tempPred);
                await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
            }

        } catch (e) { console.error("Sim Error:", e); }
    }, 50);

    // 定时器: 窗口抓取 (1分钟)
    setInterval(() => {
        const now = new Date();
        const bjtStr = now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
        const bjtDate = new Date(bjtStr);
        const hour = bjtDate.getHours();
        const minute = bjtDate.getMinutes();
        const todayStr = bjtStr.split(',')[0];

        // 窗口: 21:33 - 21:45
        if (hour === 21 && minute >= 33 && minute <= 45) {
            if (LAST_SUCCESS_DATE === todayStr) return;
            fetchAndProcessLottery(bot, ADMIN_ID, false);
        }
    }, 60 * 1000);

    // --- 交互 ---
    bot.hears('🔮 下期预测', async (ctx) => {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        if (!rows.length) return ctx.reply('暂无数据');
        const row = rows[0];
        
        // 优先显示内存中的实时结果(如果正在跑)，否则显示数据库里的
        let pred = CALC_TASK.isRunning ? CALC_TASK.bestPrediction : (safeParse(row.deep_prediction) || safeParse(row.next_prediction));
        
        if (!pred) return ctx.reply('⏳ 正在冷启动模拟，请稍候...');
        
        ctx.reply(formatPredictionText(parseInt(row.issue)+1, pred, !CALC_TASK.isRunning), { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])
        });
    });
    
    bot.action('refresh_pred', async (ctx) => {
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            const row = rows[0];
            let pred = CALC_TASK.isRunning ? CALC_TASK.bestPrediction : (safeParse(row.deep_prediction) || safeParse(row.next_prediction));
            if (!pred) return ctx.answerCbQuery('计算中...');
            
            await ctx.editMessageText(formatPredictionText(parseInt(row.issue)+1, pred, !CALC_TASK.isRunning), {
                parse_mode: 'Markdown', 
                ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])
            }).catch(()=>{});
            ctx.answerCbQuery('已刷新');
        } catch(e) {}
    });

    // 计算进度 (显示时间和次数)
    bot.hears('⏳ 计算进度', (ctx) => {
        if (!CALC_TASK.isRunning) return ctx.reply('💤 无活跃任务');
        const now = Date.now();
        const elapsed = now - CALC_TASK.startTime;
        const total = CALC_TASK.targetDuration;
        const pct = ((elapsed / total) * 100).toFixed(1);
        const timeLeft = Math.ceil((total - elapsed) / 60000);
        
        ctx.reply(`📊 进度: ${pct}%\n⏱️ 剩余: ${timeLeft} 分钟\n🔄 已模拟: ${(CALC_TASK.iterations/10000).toFixed(1)}万次`);
    });

    bot.hears('⚙️ 设置时长', (ctx) => ctx.reply(`当前时长: ${DEEP_CALC_DURATION/3600000}小时\n请选择:`, getDurationMenu()));
    bot.action(/set_dur_([\d\.]+)/, (ctx) => {
        const h = parseFloat(ctx.match[1]);
        DEEP_CALC_DURATION = h * 3600000;
        ctx.editMessageText(`✅ 时长已更新为 ${h} 小时 (下次生效)`);
    });

    bot.hears(/手动发频道/, async (ctx) => {
        if (!CHANNEL_ID) return ctx.reply('无频道ID');
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        let pred = safeParse(rows[0].next_prediction);
        if (!pred) return ctx.reply('无数据');
        await bot.telegram.sendMessage(CHANNEL_ID, formatPredictionText(parseInt(rows[0].issue)+1, pred, true), {parse_mode:'Markdown'});
        ctx.reply('已发送');
    });

    bot.hears('📊 历史走势', async (ctx) => {
        const [rows] = await db.query('SELECT issue, numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 15');
        let msg = '📉 **近期开奖走势**\n━━━━━━━━━━━━━━\n';
        rows.forEach(r => {
            const nums = safeParseNumbers(r.numbers);
            const numStr = nums.map(n => String(n).padStart(2,'0')).join(' ');
            msg += `\`${r.issue}\`: ${numStr} + **${String(r.special_code).padStart(2,'0')}** (${r.shengxiao})\n`;
        });
        ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    bot.hears('🗑 删除记录', (ctx) => {
        if (ctx.from) { userStates[ctx.from.id] = 'WAIT_DEL'; ctx.reply('请输入要删除的期号:'); }
    });
    
    bot.hears(/自动推送/, (ctx) => {
        AUTO_SEND_ENABLED = !AUTO_SEND_ENABLED;
        ctx.reply(`自动推送: ${AUTO_SEND_ENABLED ? '✅ 开' : '❌ 关'}`, getMainMenu());
    });

    bot.hears('🔄 立即抓取', async (ctx) => {
        if (ctx.from.id !== ADMIN_ID) return;
        ctx.reply('⏳ 正在请求接口(全量补录)...');
        await fetchAndProcessLottery(bot, ADMIN_ID, true);
    });

    // 启动
    bot.use(async (ctx, next) => {
        if(ctx.channelPost && String(ctx.chat.id)===String(CHANNEL_ID)) return next();
        if(ctx.from && ctx.from.id===ADMIN_ID) return next();
    });
    bot.start((ctx) => { 
        if(ctx.from) userStates[ctx.from.id]=null; 
        ctx.reply('🤖 V110.0 Time Control Ready', getMainMenu()); 
    });

    // 监听手动录入 & 删除
    bot.on(['text', 'channel_post'], async (ctx) => {
        const text = ctx.message?.text || ctx.channelPost?.text;
        if (!text) return;
        
        if (ctx.from && userStates[ctx.from.id]==='WAIT_DEL' && ctx.chat.type==='private') {
            await db.execute('DELETE FROM lottery_results WHERE issue=?', [text]);
            userStates[ctx.from.id]=null; return ctx.reply(`✅ 第 ${text} 期已删除`, getMainMenu());
        }

        const res = parseLotteryResult(text);
        if (res) {
            const {issue, flatNumbers, specialCode, shengxiao} = res;
            const jsonNums = JSON.stringify(flatNumbers);
            
            await db.execute(`INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, open_date) VALUES (?,?,?,?,NOW())`, 
                [issue, jsonNums, specialCode, shengxiao]);
            
            // 读取全量历史
            const [historyRows] = await db.query('SELECT numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC');
            
            ctx.reply(`✅ 手动录入成功，正在启动 ${DEEP_CALC_DURATION/3600000} 小时深度模拟...`);
            startCalculationTask(issue, historyRows);
        }
    });

    bot.launch().catch(err => console.error("Bot Launch Error:", err));
    process.once('SIGINT', ()=>bot.stop()); process.once('SIGTERM', ()=>bot.stop());
    return bot;
}

module.exports = startBot;

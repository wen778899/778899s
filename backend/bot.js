// 核心修复：强制 Node.js 进程使用北京时间
process.env.TZ = 'Asia/Shanghai';

const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const db = require('./db');
const { parseLotteryResult, generateSinglePrediction, scorePrediction } = require('./utils');

// --- 全局配置 ---
let AUTO_SEND_ENABLED = true;
let DEEP_CALC_DURATION = 1 * 60 * 60 * 1000; // 默认 1 小时
const LOTTERY_API_URL = 'https://history.macaumarksix.com/history/macaujc2/y/2025'; 

// 抓取状态记录
let LAST_SUCCESS_DATE = null; 

// 核心计算任务状态
let CALC_TASK = {
    isRunning: false,
    phase: 1, 
    startTime: 0,
    targetDuration: 0,
    targetIterations: 0,
    currentIssue: '',
    bestScore: -9999,
    bestPrediction: null,
    iterations: 0,
    historyCache: null,
    isProcessing: false 
};

// 用户状态
const userStates = {};

// --- 辅助函数 ---
function safeParse(data) {
    if (!data) return null;
    if (typeof data === 'string') { try { return JSON.parse(data); } catch (e) { return null; } }
    return data;
}

function getMainMenu() {
    const autoSendIcon = AUTO_SEND_ENABLED ? '✅' : '❌';
    return Markup.keyboard([
        ['🔮 下期预测', '⏳ 计算进度'],
        ['🔭 深度演算', '📊 历史走势'],
        ['⚙️ 设置时长', `${autoSendIcon} 自动推送`], 
        ['📡 手动发频道', '🔄 立即抓取'],
        ['🗑 删除记录']
    ]).resize();
}

function getDurationMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('30 分钟', 'set_dur_0.5'), Markup.button.callback('1 小时', 'set_dur_1')],
        [Markup.button.callback('3 小时', 'set_dur_3'), Markup.button.callback('5 小时', 'set_dur_5')],
        [Markup.button.callback('10 小时 (极限)', 'set_dur_10')]
    ]);
}

// 格式化文案
function formatPredictionText(issue, pred, isFinalOrTitle = false) {
    const waveMap = { red: '🔴 红波', blue: '🔵 蓝波', green: '🟢 绿波' };
    const emojiMap = { red: '🔴', blue: '🔵', green: '🟢' };
    
    let title = typeof isFinalOrTitle === 'string' ? isFinalOrTitle : 
        (isFinalOrTitle ? `🏁 第 ${issue} 期 最终决策` : `🧠 第 ${issue} 期 AI 演算中...`);
    
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
${typeof isFinalOrTitle === 'boolean' && isFinalOrTitle ? '✅ 数据库已更新' : `🔄 模型迭代: ${CALC_TASK.iterations}`}
`.trim();
}

// --- [核心升级] 全量抓取逻辑 ---
async function fetchAndProcessLottery(bot, ADMIN_ID, isManual = false) {
    try {
        console.log(`[Fetch] 正在请求 API...`);
        // 使用 axios 获取数据
        const res = await axios.get(LOTTERY_API_URL, { timeout: 20000 });
        
        if (res.data && res.data.code === 200 && res.data.data && Array.isArray(res.data.data)) {
            const list = res.data.data;
            let newCount = 0;
            let latestIssue = "";
            let latestOpenCode = "";
            
            // 倒序遍历 (从旧到新)，确保历史数据按顺序入库
            for (let i = list.length - 1; i >= 0; i--) {
                const item = list[i];
                const issue = item.expect;
                
                // 1. 查重 (防止重复)
                const [rows] = await db.query('SELECT id FROM lottery_results WHERE issue = ?', [issue]);
                if (rows.length > 0) continue; 

                // 2. 解析
                const nums = item.openCode.split(',').map(Number);
                const flatNumbers = nums.slice(0, 6);
                const specialCode = nums[6];
                const zodiacs = item.zodiac.split(',');
                const shengxiao = zodiacs[6].trim(); 

                // 3. 入库
                const jsonNums = JSON.stringify(flatNumbers);
                await db.execute(`
                    INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, open_date)
                    VALUES (?, ?, ?, ?, NOW())
                `, [issue, jsonNums, specialCode, shengxiao]);

                console.log(`[Fetch] 补录: 第 ${issue} 期`);
                newCount++;
                
                // 标记最新一期 (列表第一个是最新的)
                if (i === 0) {
                    latestIssue = issue;
                    latestOpenCode = item.openCode;
                }
            }

            // 如果有新数据，触发预测任务
            if (newCount > 0) {
                // 4. 查询最新的 60 期数据
                const [historyRows] = await db.query('SELECT numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 60');
                
                // 5. 生成预测
                const initPred = generateSinglePrediction(historyRows); 
                const jsonPred = JSON.stringify(initPred);

                // 6. 更新预测字段
                await db.execute('UPDATE lottery_results SET next_prediction=?, deep_prediction=? WHERE issue=?', [jsonPred, jsonPred, latestIssue]);

                // 7. 启动后台计算
                CALC_TASK = {
                    isRunning: true, phase: 1, startTime: Date.now(), 
                    targetDuration: DEEP_CALC_DURATION, targetIterations: 99999999, 
                    currentIssue: latestIssue, bestScore: -999, bestPrediction: initPred, 
                    iterations: 0, historyCache: historyRows, isProcessing: false
                };

                if (ADMIN_ID) {
                    const msg = isManual 
                        ? `✅ **手动抓取完成**\n共补录 ${newCount} 期数据。\n最新: 第 ${latestIssue} 期`
                        : `🎉 **自动更新**\n第 ${latestIssue} 期\n号码: ${latestOpenCode}`;
                    bot.telegram.sendMessage(ADMIN_ID, msg, { parse_mode: 'Markdown' });
                }
                
                const todayStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }).split(',')[0];
                LAST_SUCCESS_DATE = todayStr;

                return { success: true, isNew: true, count: newCount };
            } else {
                if (isManual) bot.telegram.sendMessage(ADMIN_ID, `⚠️ 暂无新数据，数据库已是最新。`);
                return { success: true, isNew: false };
            }
        }
    } catch (e) {
        console.error("[Fetch Error]", e.message);
        if (isManual) bot.telegram.sendMessage(ADMIN_ID, `❌ 抓取失败: ${e.message}`);
    }
    return { success: false };
}

// --- Bot 主逻辑 ---
function startBot() {
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const ADMIN_ID = parseInt(process.env.ADMIN_ID);
    const CHANNEL_ID = process.env.CHANNEL_ID;

    // 定时器 1: 计算心跳 (50ms)
    setInterval(async () => {
        if (!CALC_TASK.isRunning || CALC_TASK.isProcessing) return;
        const now = Date.now();
        const isTimeUp = (now - CALC_TASK.startTime) >= CALC_TASK.targetDuration;
        
        if (isTimeUp) {
            CALC_TASK.isProcessing = true;
            try {
                const nextIssue = parseInt(CALC_TASK.currentIssue) + 1;
                const jsonPred = JSON.stringify(CALC_TASK.bestPrediction);

                if (CALC_TASK.phase === 1) {
                    console.log(`[Phase 1 Done] ${CALC_TASK.currentIssue}`);
                    await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
                    
                    if (AUTO_SEND_ENABLED && CHANNEL_ID && CALC_TASK.bestPrediction) {
                        const msg = formatPredictionText(nextIssue, CALC_TASK.bestPrediction, true);
                        await bot.telegram.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
                        bot.telegram.sendMessage(ADMIN_ID, `✅ 第 ${nextIssue} 期 Phase 1 已推送。启动 Phase 2。`);
                    }
                    CALC_TASK.phase = 2;
                    CALC_TASK.startTime = Date.now(); 
                    CALC_TASK.iterations = 0;         
                    CALC_TASK.targetDuration = DEEP_CALC_DURATION; 
                    CALC_TASK.isProcessing = false; 
                    return; 
                } else if (CALC_TASK.phase === 2) {
                    console.log(`[Phase 2 Done] ${CALC_TASK.currentIssue}`);
                    CALC_TASK.isRunning = false;
                    await db.execute('UPDATE lottery_results SET deep_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
                    bot.telegram.sendMessage(ADMIN_ID, `✅ 第 ${nextIssue} 期 深度计算完成！`, {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([Markup.button.callback('👁️ 查看结果', 'show_deep_final')])
                    });
                    CALC_TASK.isProcessing = false;
                    return;
                }
            } catch (e) { console.error('Calc Error:', e); CALC_TASK.isProcessing = false; }
            return;
        }

        try {
            if (!CALC_TASK.historyCache) return;
            for(let i=0; i<200; i++) {
                const tempPred = generateSinglePrediction(CALC_TASK.historyCache);
                const score = scorePrediction(tempPred, CALC_TASK.historyCache);
                if (score > CALC_TASK.bestScore) {
                    CALC_TASK.bestScore = score;
                    CALC_TASK.bestPrediction = tempPred;
                }
                CALC_TASK.iterations++;
            }
        } catch (e) { console.error("Calc Error:", e); }
    }, 50);

    // 定时器 2: 窗口抓取 (每分钟)
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
        let pred = safeParse(row.deep_prediction) || safeParse(row.next_prediction) || CALC_TASK.bestPrediction;
        if (!pred) return ctx.reply('计算中...');
        const isCalc = CALC_TASK.isRunning && CALC_TASK.currentIssue == row.issue;
        ctx.reply(formatPredictionText(parseInt(row.issue)+1, pred, !isCalc), { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])
        });
    });
    
    bot.action('refresh_pred', async (ctx) => {
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            const row = rows[0];
            let pred = CALC_TASK.isRunning ? CALC_TASK.bestPrediction : (safeParse(row.deep_prediction) || safeParse(row.next_prediction));
            if (!pred) return ctx.answerCbQuery('暂无数据');
            const isCalc = CALC_TASK.isRunning && CALC_TASK.currentIssue == row.issue;
            await ctx.editMessageText(formatPredictionText(parseInt(row.issue)+1, pred, !isCalc), {
                parse_mode: 'Markdown', 
                ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])
            }).catch(()=>{});
            ctx.answerCbQuery('已刷新');
        } catch(e) {}
    });

    bot.hears('🔭 深度演算', async (ctx) => {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        if (!rows.length) return ctx.reply('暂无数据');
        const row = rows[0];
        const nextIssue = parseInt(row.issue) + 1;

        if (CALC_TASK.isRunning && CALC_TASK.currentIssue == row.issue) {
            const now = Date.now();
            const timePct = Math.min(100, Math.floor(((now - CALC_TASK.startTime) / CALC_TASK.targetDuration) * 100));
            const timeLeft = Math.ceil((CALC_TASK.targetDuration - (now - CALC_TASK.startTime)) / 60000);
            const text = `🌌 **演算中...**\n🎯 目标：${nextIssue} 期\n⚡ 阶段：Phase ${CALC_TASK.phase}\n🔄 迭代：${CALC_TASK.iterations.toLocaleString()}\n⏱️ 进度：${timePct}% (剩 ${timeLeft} 分)`;
            return ctx.reply(text, {parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('👁️ 偷看结果', 'peek_deep'), Markup.button.callback('🔄 刷新', 'refresh_deep')]])});
        }
        if (row.deep_prediction) {
            return ctx.reply(formatPredictionText(nextIssue, safeParse(row.deep_prediction), '🚀 深度版 (已完成)'), {parse_mode:'Markdown'});
        }
        let startPred = safeParse(row.next_prediction);
        CALC_TASK = { isRunning: true, phase: 2, startTime: Date.now(), targetDuration: DEEP_CALC_DURATION, targetIterations: 99999999, currentIssue: row.issue, bestScore: -9999, bestPrediction: startPred, iterations: 0, historyCache: null, isProcessing: false };
        ctx.replyWithMarkdown(`🚀 **深度计算已手动启动**\n🎯 目标：${nextIssue} 期\n⏱️ 时长：${DEEP_CALC_DURATION/3600000} 小时`);
    });
    
    bot.action('refresh_deep', (ctx) => ctx.answerCbQuery('请重新点击菜单查看'));
    bot.action('peek_deep', async (ctx) => {
        if (!CALC_TASK.isRunning || !CALC_TASK.bestPrediction) return ctx.answerCbQuery('暂无数据');
        await ctx.reply(formatPredictionText(parseInt(CALC_TASK.currentIssue)+1, CALC_TASK.bestPrediction, false), {parse_mode:'Markdown'});
    });
    bot.action('show_deep_final', async (ctx) => {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        let pred = safeParse(rows[0].deep_prediction);
        await ctx.reply(formatPredictionText(parseInt(rows[0].issue)+1, pred, '🚀 深度版结果'), {parse_mode:'Markdown'});
    });

    bot.hears('⏳ 计算进度', (ctx) => {
        if (!CALC_TASK.isRunning) return ctx.reply('💤 无任务');
        const now = Date.now();
        const pct = Math.min(100, Math.floor(((now - CALC_TASK.startTime)/CALC_TASK.targetDuration)*100));
        ctx.reply(`📊 进度: ${pct}%\n迭代: ${CALC_TASK.iterations}次`);
    });

    bot.hears('⚙️ 设置时长', (ctx) => ctx.reply('选择时长:', getDurationMenu()));
    bot.action(/set_dur_([\d\.]+)/, (ctx) => {
        const h = parseFloat(ctx.match[1]);
        DEEP_CALC_DURATION = h * 3600000;
        ctx.editMessageText(`✅ 时长: ${h} 小时`);
    });

    bot.hears(/手动发频道/, async (ctx) => {
        if (!CHANNEL_ID) return ctx.reply('无频道ID');
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        const row = rows[0];
        let pred = safeParse(row.deep_prediction) || safeParse(row.next_prediction);
        if (!pred) return ctx.reply('无数据');
        await bot.telegram.sendMessage(CHANNEL_ID, formatPredictionText(parseInt(row.issue)+1, pred, `📡 手动推送`), {parse_mode:'Markdown'});
        ctx.reply('已发送');
    });

    bot.hears('📊 历史走势', async (ctx) => {
        const [rows] = await db.query('SELECT issue, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 15');
        let msg = '📉 **近期特码走势**\n━━━━━━━━━━━━━━\n';
        rows.forEach(r => msg += `\`${r.issue}期\` : **${String(r.special_code).padStart(2,'0')}** (${r.shengxiao})\n`);
        ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    bot.hears('🗑 删除记录', (ctx) => {
        if (ctx.from) { userStates[ctx.from.id] = 'WAIT_DEL'; ctx.reply('请输入要删除的期号 (如 2024001):'); }
    });
    
    bot.hears(/自动推送/, (ctx) => {
        AUTO_SEND_ENABLED = !AUTO_SEND_ENABLED;
        ctx.reply(`自动推送: ${AUTO_SEND_ENABLED ? '✅ 开' : '❌ 关'}`, getMainMenu());
    });

    bot.hears('🔄 立即抓取', async (ctx) => {
        if (ctx.from.id !== ADMIN_ID) return;
        ctx.reply('⏳ 正在请求接口(全量补录)...');
        const res = await fetchAndProcessLottery(bot, ADMIN_ID, true);
        if (!res.success && !res.isNew) ctx.reply('⚠️ 数据已是最新');
    });

    // 启动
    bot.use(async (ctx, next) => {
        if(ctx.channelPost && String(ctx.chat.id)===String(CHANNEL_ID)) return next();
        if(ctx.from && ctx.from.id===ADMIN_ID) return next();
    });
    bot.start((ctx) => { 
        if(ctx.from) userStates[ctx.from.id]=null; 
        ctx.reply('🤖 V12.0 全量抓取版 Ready', getMainMenu()); 
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
            const initPred = generateSinglePrediction([]); 
            const jsonNums = JSON.stringify(flatNumbers);
            const jsonPred = JSON.stringify(initPred);
            
            await db.execute(`INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, next_prediction, deep_prediction, open_date) VALUES (?,?,?,?,?,NULL,NOW()) ON DUPLICATE KEY UPDATE numbers=?, special_code=?, shengxiao=?, next_prediction=?, deep_prediction=NULL`, 
                [issue, jsonNums, specialCode, shengxiao, jsonPred, jsonNums, specialCode, shengxiao, jsonPred]);
            
            CALC_TASK = { isRunning: true, phase: 1, startTime: Date.now(), targetDuration: DEEP_CALC_DURATION, targetIterations: 999999, currentIssue: issue, bestScore: 0, bestPrediction: initPred, iterations: 0, historyCache: null, isProcessing: false };
            if(ctx.chat?.type==='private') ctx.reply(`✅ 第 ${issue} 期录入(手动)。启动计算。`);
        }
    });

    bot.launch().catch(err => console.error("Bot Launch Error:", err));
    process.once('SIGINT', ()=>bot.stop()); process.once('SIGTERM', ()=>bot.stop());
    return bot;
}

module.exports = startBot;

// 核心配置：强制 Node.js 进程使用北京时间
process.env.TZ = 'Asia/Shanghai';

const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const db = require('./db');
const { parseLotteryResult, generateSinglePrediction, scorePrediction } = require('./utils');

// --- 全局配置 ---
let AUTO_SEND_ENABLED = true;
let DEEP_CALC_DURATION = 1 * 60 * 60 * 1000; // 默认 1 小时
const LOTTERY_API_URL = 'https://history.macaumarksix.com/history/macaujc2/y/2025'; 

// 抓取状态记录 (防止同一天重复抓取)
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
        ['📡 手动发频道', '🔄 立即抓取']
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
    
    // 增加头数显示
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

// --- 核心逻辑：执行抓取与数据闭环 ---
async function fetchAndProcessLottery(bot, ADMIN_ID, isManual = false) {
    try {
        console.log(`[Fetch] 正在请求 API...`);
        const res = await axios.get(LOTTERY_API_URL, { timeout: 15000 }); // 超时15秒
        
        if (res.data && res.data.code === 200 && res.data.data && res.data.data.length > 0) {
            // API 返回的是数组，data[0] 是最新的
            const latest = res.data.data[0]; 
            const issue = latest.expect;
            const openCodeStr = latest.openCode; 
            
            // 1. 查重 (非常重要，防止重复计算)
            const [rows] = await db.query('SELECT id FROM lottery_results WHERE issue = ?', [issue]);
            if (rows.length > 0) {
                if (isManual) bot.telegram.sendMessage(ADMIN_ID, `⚠️ 第 ${issue} 期已存在，无需重复录入。`);
                return { success: true, isNew: false }; // 已存在
            }

            console.log(`[Fetch] 发现新数据: ${issue} - ${openCodeStr}`);

            // 2. 解析数据
            const nums = openCodeStr.split(',').map(Number);
            const flatNumbers = nums.slice(0, 6);
            const specialCode = nums[6];
            const zodiacs = latest.zodiac.split(',');
            const shengxiao = zodiacs[6].trim(); 

            // 3. [关键步骤] 存入数据库
            const jsonNums = JSON.stringify(flatNumbers);
            // 先存入基础数据，prediction 字段暂时放空或放初始值
            await db.execute(`
                INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, open_date)
                VALUES (?, ?, ?, ?, NOW())
            `, [issue, jsonNums, specialCode, shengxiao]);

            // 4. [关键步骤] 立即查询最新 60 期数据 (包含刚才插入的那条)
            // 确保预测算法能读到最新的这一期，从而预测下一期
            const [historyRows] = await db.query('SELECT numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 60');
            
            // 5. 生成初始预测 (V10.5 算法)
            const initPred = generateSinglePrediction(historyRows); 
            const jsonPred = JSON.stringify(initPred);

            // 6. 更新数据库 (把预测结果补进去)
            // 注意：这里更新的是"当前期"的 next_prediction 字段，
            // 实际上这个预测是针对"下一期"的，但按您的逻辑是存放在当前行方便读取
            await db.execute('UPDATE lottery_results SET next_prediction=?, deep_prediction=? WHERE issue=?', [jsonPred, jsonPred, issue]);

            // 7. 启动后台深度计算任务 (用于不断优化预测)
            CALC_TASK = {
                isRunning: true,
                phase: 1,
                startTime: Date.now(),
                targetDuration: DEEP_CALC_DURATION,
                targetIterations: 999999,
                currentIssue: issue,
                bestScore: -999,
                bestPrediction: initPred,
                iterations: 0,
                historyCache: historyRows, // 放入缓存
                isProcessing: false
            };

            // 8. 通知管理员
            if (ADMIN_ID) {
                bot.telegram.sendMessage(ADMIN_ID, `🎉 **自动抓取成功！**\n\n第 ${issue} 期\n号码: ${openCodeStr}\n特肖: ${shengxiao}\n\n🚀 数据已入库，V10.5 预测任务已启动！`, { parse_mode: 'Markdown' });
            }
            
            // 9. 更新成功日期标记
            const todayStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }).split(',')[0];
            LAST_SUCCESS_DATE = todayStr;

            return { success: true, isNew: true };
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

    // ============================
    // 定时器 1: 预测计算 (Heartbeat - 50ms)
    // ============================
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
                    // Phase 1 结束 -> 发送 -> Phase 2
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
                    // Phase 2 结束 -> 停止
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
            } catch (e) { console.error('Calc Task Error:', e); CALC_TASK.isProcessing = false; }
            return;
        }

        // 蒙特卡洛模拟
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

    // ============================
    // 定时器 2: 时间窗口抓取调度器 (每 1 分钟检查一次)
    // ============================
    setInterval(() => {
        const now = new Date();
        const bjtStr = now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
        const bjtDate = new Date(bjtStr);
        
        const hour = bjtDate.getHours();
        const minute = bjtDate.getMinutes();
        const todayStr = bjtStr.split(',')[0]; // 获取日期部分 "5/30/2025"

        // 设定窗口: 21:33 <= 时间 <= 21:45
        // 且 今天还没有抓取成功过
        if (hour === 21 && minute >= 33 && minute <= 45) {
            if (LAST_SUCCESS_DATE === todayStr) {
                // 今天已经抓到了，不再请求，节省资源
                return;
            }
            
            console.log(`[Scheduler] 进入抓取窗口 (${hour}:${minute})，开始请求...`);
            fetchAndProcessLottery(bot, ADMIN_ID, false);
        } else {
            // 不在窗口期，什么都不做
            // console.log(`[Scheduler] 休眠中... ${hour}:${minute}`);
        }
    }, 60 * 1000); // 60秒检查一次

    // --- 交互功能区 ---
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
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        const row = rows[0];
        let pred = safeParse(row.deep_prediction) || safeParse(row.next_prediction) || CALC_TASK.bestPrediction;
        await ctx.editMessageText(formatPredictionText(parseInt(row.issue)+1, pred), {
            parse_mode: 'Markdown', 
            ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])
        }).catch(()=>{});
        ctx.answerCbQuery('已刷新');
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
            const text = `🌌 **演算中...**\n🎯 目标：${nextIssue} 期\n⚡ 阶段：Phase ${CALC_TASK.phase}\n🔄 迭代：${CALC_TASK.iterations}\n⏱️ 进度：${timePct}% (剩 ${timeLeft} 分)`;
            return ctx.reply(text, {parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('👁️ 偷看结果', 'peek_deep'), Markup.button.callback('🔄 刷新', 'refresh_deep')]])});
        }
        if (row.deep_prediction) {
            return ctx.reply(formatPredictionText(nextIssue, safeParse(row.deep_prediction), '🚀 深度版 (已完成)'), {parse_mode:'Markdown'});
        }
        // 手动启动
        let startPred = safeParse(row.next_prediction);
        CALC_TASK = { isRunning: true, phase: 2, startTime: Date.now(), targetDuration: DEEP_CALC_DURATION, targetIterations: 5000000, currentIssue: row.issue, bestScore: -9999, bestPrediction: startPred, iterations: 0, historyCache: null, isProcessing: false };
        ctx.replyWithMarkdown(`🚀 **深度计算已手动启动**\n🎯 目标：${nextIssue} 期\n⏱️ 时长：${DEEP_CALC_DURATION/3600000} 小时`);
    });
    
    bot.action('refresh_deep', (ctx) => ctx.answerCbQuery('请重新点击菜单查看'));
    bot.action('peek_deep', async (ctx) => {
        if (!CALC_TASK.isRunning || !CALC_TASK.bestPrediction) return ctx.answerCbQuery('暂无数据');
        await ctx.reply(formatPredictionText(parseInt(CALC_TASK.currentIssue)+1, CALC_TASK.bestPrediction, '👁️ 偷看'), {parse_mode:'Markdown'});
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
        ctx.reply(`📊 进度: ${pct}%`);
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
        if (ctx.from) { userStates[ctx.from.id] = 'WAIT_DEL'; ctx.reply('输入期号:'); }
    });
    
    bot.hears(/自动推送/, (ctx) => {
        AUTO_SEND_ENABLED = !AUTO_SEND_ENABLED;
        ctx.reply(`自动推送: ${AUTO_SEND_ENABLED ? '✅ 开' : '❌ 关'}`, getMainMenu());
    });

    bot.hears('🔄 立即抓取', async (ctx) => {
        if (ctx.from.id !== ADMIN_ID) return;
        ctx.reply('⏳ 正在请求接口...');
        const res = await fetchAndProcessLottery(bot, ADMIN_ID, true);
        if (!res.success && !res.isNew) ctx.reply('⚠️ 当前已是最新数据');
    });

    // 启动
    bot.use(async (ctx, next) => {
        if(ctx.channelPost && String(ctx.chat.id)===String(CHANNEL_ID)) return next();
        if(ctx.from && ctx.from.id===ADMIN_ID) return next();
    });
    bot.start((ctx) => { 
        if(ctx.from) userStates[ctx.from.id]=null; 
        ctx.reply('🤖 V11.0 定时抓取版 Ready', getMainMenu()); 
    });

    // 监听手动文本录入 (作为备用)
    bot.on(['text', 'channel_post'], async (ctx) => {
        const text = ctx.message?.text || ctx.channelPost?.text;
        if (!text) return;
        
        // 删除逻辑
        if (ctx.from && userStates[ctx.from.id]==='WAIT_DEL' && ctx.chat.type==='private') {
            await db.execute('DELETE FROM lottery_results WHERE issue=?', [text]);
            userStates[ctx.from.id]=null; return ctx.reply('已删除');
        }

        // 手动录入
        const res = parseLotteryResult(text);
        if (res) {
            const {issue, flatNumbers, specialCode, shengxiao} = res;
            const initPred = generateSinglePrediction([]); 
            const jsonNums = JSON.stringify(flatNumbers);
            const jsonPred = JSON.stringify(initPred);
            
            await db.execute(`INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, next_prediction, deep_prediction, open_date) VALUES (?,?,?,?,?,NULL,NOW()) ON DUPLICATE KEY UPDATE numbers=?, special_code=?, shengxiao=?, next_prediction=?, deep_prediction=NULL`, 
                [issue, jsonNums, specialCode, shengxiao, jPred, jNum, specialCode, shengxiao, jPred]);
            
            CALC_TASK = { isRunning: true, phase: 1, startTime: Date.now(), targetDuration: DEEP_CALC_DURATION, targetIterations: 99999, currentIssue: issue, bestScore: 0, bestPrediction: initPred, iterations: 0, historyCache: null, isProcessing: false };
            if(ctx.chat?.type==='private') ctx.reply(`✅ 第 ${issue} 期录入(手动)。启动计算。`);
        }
    });

    bot.launch().catch(err => console.error("Bot Launch Error:", err));
    process.once('SIGINT', ()=>bot.stop()); process.once('SIGTERM', ()=>bot.stop());
    return bot;
}

module.exports = startBot;

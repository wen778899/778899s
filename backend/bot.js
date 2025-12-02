// 核心修复：强制 Node.js 进程使用北京时间
process.env.TZ = 'Asia/Shanghai';

const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const { parseLotteryResult, generateSinglePrediction, scorePrediction } = require('./utils');

// --- 全局配置 ---
let AUTO_SEND_ENABLED = true;
let DEEP_CALC_DURATION = 1 * 60 * 60 * 1000; // 默认1小时

// 核心状态机
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

function safeParse(data) {
    if (!data) return null;
    if (typeof data === 'string') { try { return JSON.parse(data); } catch (e) { return null; } }
    return data;
}

function getMainMenu() {
    return Markup.keyboard([
        ['🔮 下期预测', '⏳ 计算进度'],
        ['🔭 深度演算', '📊 历史走势'],
        ['⚙️ 设置时长', `自动推送: ${AUTO_SEND_ENABLED?'开':'关'}`], 
        ['📡 手动发频道', '🗑 删除记录']
    ]).resize();
}

function getDurationMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('30 分钟', 'set_dur_0.5'), Markup.button.callback('1 小时', 'set_dur_1')],
        [Markup.button.callback('3 小时', 'set_dur_3'), Markup.button.callback('5 小时', 'set_dur_5')]
    ]);
}

function formatPredictionText(issue, pred, titleStr = '') {
    const waveMap = { red: '🔴 红波', blue: '🔵 蓝波', green: '🟢 绿波' };
    const title = titleStr ? titleStr : `🚀 第 ${issue} 期 智能决策 (V10.3)`;
    
    let zodiacGrid = '';
    if (pred.zodiac_one_code && Array.isArray(pred.zodiac_one_code)) {
        zodiacGrid = pred.zodiac_one_code.map(i => `${i.zodiac}[${String(i.num).padStart(2,'0')}]`).join('  ');
    }

    return `
${title}
━━━━━━━━━━━━━━
🔥 **五肖中特** (必中核心)
**${pred.liu_xiao ? pred.liu_xiao.join(' - ') : '?'}**

🎯 **主攻三肖**
${pred.zhu_san ? pred.zhu_san.join(' ') : '?'}

🦁 **一码阵 (参考)**
${zodiacGrid}

🚫 **绝杀三肖** (避雷)
${pred.kill_zodiacs ? pred.kill_zodiacs.join(' ') : '无'}

🔢 **围捕数据**
尾数：${pred.rec_tails ? pred.rec_tails.join('.') : '?'} 尾
波色：${waveMap[pred.zhu_bo]} (防${waveMap[pred.fang_bo]})
形态：${pred.da_xiao}/${pred.dan_shuang}
━━━━━━━━━━━━━━
${titleStr.includes('发布') ? '✅ 数据库已同步' : '🔄 实时运算中...'}
`.trim();
}

function startBot() {
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const ADMIN_ID = parseInt(process.env.ADMIN_ID);
    const CHANNEL_ID = process.env.CHANNEL_ID;

    // --- 后台任务 (Heartbeat) ---
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
                    console.log(`Phase 1 Done: ${CALC_TASK.currentIssue}`);
                    await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
                    
                    if (AUTO_SEND_ENABLED && CHANNEL_ID && CALC_TASK.bestPrediction) {
                        const msg = formatPredictionText(nextIssue, CALC_TASK.bestPrediction, `🏁 第 ${nextIssue} 期 预测发布`);
                        await bot.telegram.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
                        bot.telegram.sendMessage(ADMIN_ID, `✅ 第 ${nextIssue} 期 (Phase 1) 已推送。启动深度校验。`);
                    }
                    CALC_TASK.phase = 2;
                    CALC_TASK.startTime = Date.now(); 
                    CALC_TASK.iterations = 0;         
                    CALC_TASK.targetDuration = DEEP_CALC_DURATION;
                    CALC_TASK.isProcessing = false; 
                    return; 
                } 
                else {
                    console.log(`Phase 2 Done: ${CALC_TASK.currentIssue}`);
                    CALC_TASK.isRunning = false;
                    await db.execute('UPDATE lottery_results SET deep_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
                    bot.telegram.sendMessage(ADMIN_ID, `✅ 第 ${nextIssue} 期 **深度计算** 全部完成！`);
                    CALC_TASK.isProcessing = false;
                    return;
                }
            } catch (e) { console.error('任务失败:', e); CALC_TASK.isProcessing = false; }
            return;
        }

        try {
            if (!CALC_TASK.historyCache) {
                const [rows] = await db.query('SELECT numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 60');
                CALC_TASK.historyCache = rows;
            }
            // 蒙特卡洛迭代
            for(let i=0; i<100; i++) {
                const tempPred = generateSinglePrediction(CALC_TASK.historyCache);
                const score = scorePrediction(tempPred, CALC_TASK.historyCache);
                if (score > CALC_TASK.bestScore) {
                    CALC_TASK.bestScore = score;
                    CALC_TASK.bestPrediction = tempPred;
                }
                CALC_TASK.iterations++;
            }
        } catch (e) { console.error("计算出错:", e); }
    }, 50);

    // --- 交互功能 ---
    bot.hears('🔮 下期预测', async (ctx) => {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        if (!rows.length) return ctx.reply('暂无数据');
        const row = rows[0];
        let pred = safeParse(row.deep_prediction) || safeParse(row.next_prediction) || CALC_TASK.bestPrediction;
        if (!pred) return ctx.reply('计算中...');
        const isCalculating = CALC_TASK.isRunning && CALC_TASK.currentIssue == row.issue;
        const text = formatPredictionText(parseInt(row.issue)+1, pred, !isCalculating);
        const extra = { parse_mode: 'Markdown', ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')]) };
        ctx.reply(text, extra);
    });
    bot.action('refresh_pred', async (ctx) => {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        const row = rows[0];
        let pred = safeParse(row.deep_prediction) || safeParse(row.next_prediction) || CALC_TASK.bestPrediction;
        const text = formatPredictionText(parseInt(row.issue)+1, pred);
        await ctx.editMessageText(text, {parse_mode:'Markdown', ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])}).catch(()=>{});
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
            const timeLeft = Math.ceil((CALC_TASK.targetDuration - (now - CALC_TASK.startTime)) / 1000 / 60);
            const text = `🌌 **演算中...**\n🎯 目标：${nextIssue} 期\n⚡ 阶段：Phase ${CALC_TASK.phase}\n🔄 迭代：${CALC_TASK.iterations}\n⏱️ 进度：${timePct}% (剩 ${timeLeft} 分)`;
            return ctx.reply(text, {parse_mode:'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('👁️ 偷看结果', 'peek_deep'), Markup.button.callback('🔄 刷新', 'refresh_deep')]])});
        }
        if (row.deep_prediction) {
            return ctx.reply(formatPredictionText(nextIssue, safeParse(row.deep_prediction), '🚀 深度版 (已完成)'), {parse_mode:'Markdown'});
        }
        // 手动启动
        let startPred = safeParse(row.next_prediction);
        CALC_TASK = { isRunning: true, phase: 2, startTime: Date.now(), targetDuration: DEEP_CALC_DURATION, targetIterations: 500000, currentIssue: row.issue, bestScore: -9999, bestPrediction: startPred, iterations: 0, historyCache: null, isProcessing: false };
        ctx.replyWithMarkdown(`🚀 **深度计算已手动启动**\n🎯 目标：${nextIssue} 期\n⏱️ 时长：${DEEP_CALC_DURATION/3600000} 小时`);
    });
    
    bot.action('refresh_deep', (ctx) => ctx.answerCbQuery('请重新点击菜单查看')); // 简化处理
    bot.action('peek_deep', async (ctx) => {
        if (!CALC_TASK.isRunning || !CALC_TASK.bestPrediction) return ctx.answerCbQuery('暂无数据');
        await ctx.reply(formatPredictionText(parseInt(CALC_TASK.currentIssue)+1, CALC_TASK.bestPrediction, '👁️ 偷看'), {parse_mode:'Markdown'});
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

    bot.hears(/自动推送/, (ctx) => { AUTO_SEND_ENABLED = !AUTO_SEND_ENABLED; ctx.reply(`自动推送: ${AUTO_SEND_ENABLED?'开':'关'}`, getMainMenu()); });
    bot.hears('🗑 删除记录', (ctx) => { if(ctx.from) userStates[ctx.from.id]='WAIT_DEL'; ctx.reply('输入期号:'); });

    bot.use(async (ctx, next) => {
        if(ctx.channelPost && String(ctx.chat.id)===String(CHANNEL_ID)) return next();
        if(ctx.from && ctx.from.id===ADMIN_ID) return next();
    });
    bot.start((ctx) => { if(ctx.from) userStates[ctx.from.id]=null; ctx.reply('V10.3 Ready', getMainMenu()); });

    bot.on(['text', 'channel_post'], async (ctx) => {
        const text = ctx.message?.text || ctx.channelPost?.text;
        if (!text) return;
        if (ctx.from && userStates[ctx.from.id]==='WAIT_DEL' && ctx.chat.type==='private') {
            await db.execute('DELETE FROM lottery_results WHERE issue=?', [text]);
            userStates[ctx.from.id]=null; return ctx.reply('已删除');
        }
        const res = parseLotteryResult(text);
        if (res) {
            const {issue, flatNumbers, specialCode, shengxiao} = res;
            const initPred = generateSinglePrediction([]); 
            const jNum = JSON.stringify(flatNumbers);
            const jPred = JSON.stringify(initPred);
            
            await db.execute(`INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, next_prediction, deep_prediction, open_date) VALUES (?,?,?,?,?,NULL,NOW()) ON DUPLICATE KEY UPDATE numbers=?, special_code=?, shengxiao=?, next_prediction=?, deep_prediction=NULL, open_date=NOW()`, 
                [issue, jNum, specialCode, shengxiao, jPred, jNum, specialCode, shengxiao, jPred]);
            
            CALC_TASK = { isRunning: true, phase: 1, startTime: Date.now(), targetDuration: DEEP_CALC_DURATION, targetIterations: 99999, currentIssue: issue, bestScore: 0, bestPrediction: initPred, iterations: 0, historyCache: null, isProcessing: false };
            if(ctx.chat?.type==='private') ctx.reply(`✅ 第 ${issue} 期录入。V10.3 启动 (${DEEP_CALC_DURATION/3600000}h)`);
        }
    });

    bot.launch();
    process.once('SIGINT', ()=>bot.stop()); process.once('SIGTERM', ()=>bot.stop());
    return bot;
}

module.exports = startBot;

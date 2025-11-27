const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const { parseLotteryResult, generateSinglePrediction, scorePrediction } = require('./utils');

// --- 全局状态管理 ---
let CALC_TASK = {
    isRunning: false, startTime: 0, targetDuration: 2 * 60 * 60 * 1000, 
    currentIssue: '', bestScore: -1, bestPrediction: null, iterations: 0
};

// 用户的操作状态 (用于处理多步交互，如删除确认)
const userStates = {}; 

// --- 辅助函数 ---
function formatPredictionText(issue, pred, isFinal = false) {
    const waveMap = { red: '🔴 红波', blue: '🔵 蓝波', green: '🟢 绿波' };
    const title = isFinal ? `🏁 第 ${issue} 期 最终决策` : `🧠 第 ${issue} 期 AI 演算中...`;
    
    return `
${title}
━━━━━━━━━━━━━━
🎯 **六肖推荐**
${pred.liu_xiao.join(' ')}

🔥 **主攻三肖**
${pred.zhu_san.join(' ')}

🔢 **数据围捕**
头数：${pred.hot_head}头 | 尾数：${pred.hot_tail}尾

🌊 **波色定位**
主：${waveMap[pred.zhu_bo]} | 防：${waveMap[pred.fang_bo]}

⚖️ **形态参考**
${pred.da_xiao} / ${pred.dan_shuang}
━━━━━━━━━━━━━━
${isFinal ? '✅ 数据库已更新' : '⏳ 深度模型正在回测头尾数规律...'}
`.trim();
}

// 后台计算循环 (保持逻辑不变，只引用新的 utils)
function startBackgroundTask() {
    setInterval(async () => {
        if (!CALC_TASK.isRunning) return;
        const now = Date.now();
        if (now - CALC_TASK.startTime >= CALC_TASK.targetDuration) {
            CALC_TASK.isRunning = false;
            console.log(`[计算完成] 第 ${CALC_TASK.currentIssue} 期`);
            return;
        }
        try {
            const [historyRows] = await db.query('SELECT numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 100');
            for(let i=0; i<10; i++) {
                const tempPred = generateSinglePrediction(historyRows);
                const score = scorePrediction(tempPred, historyRows);
                if (score > CALC_TASK.bestScore) {
                    CALC_TASK.bestScore = score;
                    CALC_TASK.bestPrediction = tempPred;
                    const jsonPred = JSON.stringify(tempPred);
                    await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
                }
                CALC_TASK.iterations++;
            }
        } catch (e) { console.error("后台计算出错:", e); }
    }, 5000);
}

function startBot() {
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const ADMIN_ID = parseInt(process.env.ADMIN_ID);
    const CHANNEL_ID = process.env.CHANNEL_ID; 

    startBackgroundTask();

    // 键盘菜单：增加[删除记录]
    const mainMenu = Markup.keyboard([
        ['🔮 下期预测', '📊 历史走势'],
        ['📡 发送到频道', '🗑 删除记录'],
        ['⏳ 查看计算进度', '🔙 返回主页']
    ]).resize();

    // 权限校验
    bot.use(async (ctx, next) => {
        if (ctx.channelPost) {
            if (CHANNEL_ID && String(ctx.chat.id) === String(CHANNEL_ID)) return next();
            return; 
        }
        if (ctx.from && ctx.from.id === ADMIN_ID) return next();
    });

    bot.start((ctx) => {
        userStates[ctx.from.id] = null; // 重置状态
        ctx.reply('🤖 智能预测系统 V3.0 (含头尾数分析) 已就绪', mainMenu);
    });

    // --- 菜单功能 ---

    // 1. 下期预测
    bot.hears('🔮 下期预测', async (ctx) => {
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            if (rows.length === 0) return ctx.reply('无数据');
            const row = rows[0];
            const nextIssue = parseInt(row.issue) + 1;
            let pred = row.next_prediction;
            if (typeof pred === 'string') pred = JSON.parse(pred);
            const isRunning = CALC_TASK.isRunning && CALC_TASK.currentIssue == row.issue;
            ctx.reply(formatPredictionText(nextIssue, pred, !isRunning), { parse_mode: 'Markdown' });
        } catch (e) { ctx.reply('获取失败'); }
    });

    // 2. 历史走势
    bot.hears('📊 历史走势', async (ctx) => {
        const [rows] = await db.query('SELECT issue, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 8');
        let msg = '📉 **近期特码走势**\n';
        rows.forEach(r => msg += `\`${r.issue}\` : ${r.special_code} (${r.shengxiao})\n`);
        ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // 3. 发送到频道
    bot.hears('📡 发送到频道', async (ctx) => {
        if (!CHANNEL_ID) return ctx.reply('❌ 未配置频道 ID');
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            const row = rows[0];
            const nextIssue = parseInt(row.issue) + 1;
            let pred = row.next_prediction;
            if (typeof pred === 'string') pred = JSON.parse(pred);
            const msg = formatPredictionText(nextIssue, pred, !CALC_TASK.isRunning);
            await ctx.telegram.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
            ctx.reply('✅ 已推送到频道');
        } catch (e) { ctx.reply('❌ 推送失败'); }
    });

    // 4. 查看进度
    bot.hears('⏳ 查看计算进度', (ctx) => {
        if (!CALC_TASK.isRunning) return ctx.reply('💤 当前无计算任务');
        const now = Date.now();
        const percent = Math.min(100, Math.floor(((now - CALC_TASK.startTime) / CALC_TASK.targetDuration) * 100));
        ctx.reply(`🖥 **AI 深度计算中**\n模拟次数：${CALC_TASK.iterations}\n当前最佳评分：${CALC_TASK.bestScore.toFixed(1)}\n进度：${percent}%`);
    });

    // 5. 🗑 删除记录 (进入删除模式)
    bot.hears('🗑 删除记录', (ctx) => {
        userStates[ctx.from.id] = 'WAITING_DELETE_ISSUE';
        ctx.reply('⚠️ **进入删除模式**\n\n请输入您想删除的 **期号** (例如 2025334)\n\n发送 "取消" 可退出。', Markup.removeKeyboard());
    });

    bot.hears('🔙 返回主页', (ctx) => {
        userStates[ctx.from.id] = null;
        ctx.reply('已返回', mainMenu);
    });

    // --- 监听所有文本消息 (处理录入 和 删除逻辑) ---
    bot.on(['text', 'channel_post'], async (ctx) => {
        const text = ctx.message?.text || ctx.channelPost?.text;
        if (!text) return;

        // A. 优先处理：删除逻辑 (仅限私聊)
        if (ctx.chat.type === 'private' && userStates[ctx.from.id] === 'WAITING_DELETE_ISSUE') {
            if (text === '取消') {
                userStates[ctx.from.id] = null;
                return ctx.reply('已取消操作', mainMenu);
            }
            
            // 校验是否是期号 (纯数字)
            if (!/^\d+$/.test(text)) {
                return ctx.reply('❌ 格式错误，请输入纯数字期号。');
            }

            try {
                // 执行删除
                const [result] = await db.execute('DELETE FROM lottery_results WHERE issue = ?', [text]);
                userStates[ctx.from.id] = null; // 重置状态
                
                if (result.affectedRows > 0) {
                    return ctx.reply(`✅ 第 ${text} 期记录已删除！`, mainMenu);
                } else {
                    return ctx.reply(`❌ 找不到第 ${text} 期的数据。`, mainMenu);
                }
            } catch (e) {
                console.error(e);
                return ctx.reply('数据库错误', mainMenu);
            }
        }

        // B. 默认处理：开奖录入 (解析 & 计算)
        const result = parseLotteryResult(text);
        if (result) {
            const { issue, flatNumbers, specialCode, shengxiao } = result;
            
            let initialPred = {};
            try {
                const [historyRows] = await db.query('SELECT numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 50');
                initialPred = generateSinglePrediction(historyRows);
            } catch(e) { initialPred = generateSinglePrediction([]); }

            const jsonNums = JSON.stringify(flatNumbers);
            const jsonPred = JSON.stringify(initialPred);
            
            try {
                await db.execute(`
                    INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, next_prediction, open_date)
                    VALUES (?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE numbers=?, special_code=?, shengxiao=?, next_prediction=?, open_date=NOW()
                `, [issue, jsonNums, specialCode, shengxiao, jsonPred, jsonNums, specialCode, shengxiao, jsonPred]);

                // 启动任务
                CALC_TASK = {
                    isRunning: true, startTime: Date.now(), targetDuration: 2 * 60 * 60 * 1000,
                    currentIssue: issue, bestScore: -1, bestPrediction: initialPred, iterations: 0
                };

                const reply = `✅ **第 ${issue} 期录入成功**\n特码：${specialCode} (${shengxiao})\n\n🚀 **头尾数分析模型已启动** (预计2小时)`;
                if (ctx.chat.type === 'private') ctx.replyWithMarkdown(reply);
            } catch (err) { console.error(err); }
        }
    });

    bot.launch().catch(err => console.error(err));
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
}

module.exports = startBot;
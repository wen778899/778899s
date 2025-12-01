const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const { parseLotteryResult, generateSinglePrediction, scorePrediction } = require('./utils');

// --- 全局配置 ---
let AUTO_SEND_ENABLED = true;
let DEEP_CALC_DURATION = 3 * 60 * 60 * 1000; // 默认 3 小时

// 核心状态机 (来自 File 72)
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
    historyCache: null
};

const userStates = {};

// --- 菜单定义 ---
function getMainMenu() {
    const autoSendIcon = AUTO_SEND_ENABLED ? '✅' : '❌';
    const autoSendText = `${autoSendIcon} 自动推送: ${AUTO_SEND_ENABLED ? '开' : '关'}`;
    
    return Markup.keyboard([
        ['🔮 下期预测', '⏳ 计算进度'],
        ['🔭 深度演算', '📊 历史走势'],
        ['⚙️ 设置时长', autoSendText], 
        ['📡 手动发频道', '🗑 删除记录']
    ]).resize();
}

function getDurationMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('⏱️ 1 小时', 'set_dur_1'), Markup.button.callback('⏱️ 3 小时 (默认)', 'set_dur_3')],
        [Markup.button.callback('⏱️ 5 小时', 'set_dur_5'), Markup.button.callback('⏱️ 8 小时', 'set_dur_8')],
        [Markup.button.callback('⏱️ 12 小时 (极致)', 'set_dur_12')]
    ]);
}

// 格式化文案 (来自 File 72)
function formatPredictionText(issue, pred, isFinalOrTitle = false) {
    const waveMap = { red: '🔴 红波', blue: '🔵 蓝波', green: '🟢 绿波' };
    
    let title = '';
    if (typeof isFinalOrTitle === 'string') {
        title = isFinalOrTitle;
    } else {
        title = isFinalOrTitle ? `🏁 第 ${issue} 期 最终决策` : `🧠 第 ${issue} 期 AI 演算中...`;
    }
    
    const safeJoin = (arr) => arr ? arr.join(' ') : '?';
    
    // 格式化一肖一码阵
    let zodiacGrid = '';
    if (pred.zodiac_one_code && Array.isArray(pred.zodiac_one_code)) {
        let lines = [];
        let currentLine = [];
        pred.zodiac_one_code.forEach((item, index) => {
            const numStr = String(item.num).padStart(2, '0');
            currentLine.push(`${item.zodiac}[${numStr}]`);
            if ((index + 1) % 4 === 0) { // 改为每行4个更美观
                lines.push(currentLine.join('  '));
                currentLine = [];
            }
        });
        if (currentLine.length > 0) lines.push(currentLine.join('  '));
        zodiacGrid = lines.join('\n');
    } else {
        zodiacGrid = '数据计算中...';
    }

    // 杀号信息
    const killInfo = pred.kill_zodiacs ? `\n\n🚫 **智能杀肖**: ${pred.kill_zodiacs.join(' ')}` : '';

    return `
${title}
━━━━━━━━━━━━━━
🦁 **全肖一码阵** (重点推荐)
${zodiacGrid}

🎯 **六肖推荐**
${safeJoin(pred.liu_xiao)}

🔥 **主攻三肖**
${safeJoin(pred.zhu_san)}

🔢 **数据围捕**
头数：主 ${pred.hot_head} 头 | 防 ${pred.fang_head} 头
尾数：推荐 ${safeJoin(pred.rec_tails)} 尾

🌊 **波色定位**
主：${waveMap[pred.zhu_bo]} | 防：${waveMap[pred.fang_bo]}

⚖️ **形态参考**
${pred.da_xiao} / ${pred.dan_shuang}${killInfo}
━━━━━━━━━━━━━━
${typeof isFinalOrTitle === 'boolean' && isFinalOrTitle ? '✅ 数据库已更新 | 等待开奖验证' : `🔄 模型迭代次数: ${CALC_TASK.iterations}`}
`.trim();
}

// --- Bot 主逻辑 ---
function startBot() {
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const ADMIN_ID = parseInt(process.env.ADMIN_ID);
    const CHANNEL_ID = process.env.CHANNEL_ID;

    // --- 后台计算任务循环 (结合 File 72 的机制) ---
    setInterval(async () => {
        if (!CALC_TASK.isRunning) return;

        const now = Date.now();
        const timeElapsed = now - CALC_TASK.startTime;
        const isTimeUp = timeElapsed >= CALC_TASK.targetDuration;
        const isIterUp = CALC_TASK.iterations >= CALC_TASK.targetIterations;

        if (isTimeUp && isIterUp) {
            CALC_TASK.isRunning = false;
            console.log(`[计算完成] 第 ${CALC_TASK.currentIssue} 期`);
            
            try {
                const nextIssue = parseInt(CALC_TASK.currentIssue) + 1;
                const jsonPred = JSON.stringify(CALC_TASK.bestPrediction);

                if (CALC_TASK.phase === 1) {
                    await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
                    
                    if (AUTO_SEND_ENABLED && CHANNEL_ID && CALC_TASK.bestPrediction) {
                        const msg = formatPredictionText(nextIssue, CALC_TASK.bestPrediction, true);
                        await bot.telegram.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
                        bot.telegram.sendMessage(ADMIN_ID, `✅ 第 ${nextIssue} 期 (基础版) 推送完成。`);
                    }
                } 
                else if (CALC_TASK.phase === 2) {
                    await db.execute('UPDATE lottery_results SET deep_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
                    bot.telegram.sendMessage(ADMIN_ID, `✅ 第 ${nextIssue} 期 **深度计算** 已完成！\n请点击下方按钮查看或手动发送。`);
                }
            } catch (e) { console.error('任务完成处理失败:', e); }
            return;
        }

        // --- 执行计算 ---
        try {
            if (!CALC_TASK.historyCache) {
                const [rows] = await db.query('SELECT numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 50');
                CALC_TASK.historyCache = rows;
            }
            
            // 每次 Tick 跑 500 次模拟
            for(let i=0; i<500; i++) {
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

    // --- 中间件 ---
    bot.use(async (ctx, next) => {
        if (ctx.channelPost) {
            if (CHANNEL_ID && String(ctx.chat.id) === String(CHANNEL_ID)) return next();
            return;
        }
        if (ctx.from && ctx.from.id === ADMIN_ID) return next();
    });

    bot.start((ctx) => {
        userStates[ctx.from.id] = null;
        ctx.reply('🤖 五行杀号算法系统 (Fusion V8.0) 已就绪', getMainMenu());
    });

    // --- 功能实现 ---

    // 1. 设置时长
    bot.hears('⚙️ 设置时长', (ctx) => {
        const h = DEEP_CALC_DURATION / 3600000;
        ctx.reply(`当前深度计算时长: ${h} 小时\n请选择新的时长:`, getDurationMenu());
    });
    bot.action(/set_dur_(\d+)/, (ctx) => {
        const hours = parseInt(ctx.match[1]);
        DEEP_CALC_DURATION = hours * 60 * 60 * 1000;
        ctx.answerCbQuery(`已设置为 ${hours} 小时`);
        ctx.editMessageText(`✅ 深度计算时长已更新为: ${hours} 小时 (下次生效)`);
    });

    // 2. 下期预测
    bot.hears('🔮 下期预测', async (ctx) => {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        if (!rows.length) return ctx.reply('暂无数据');
        
        const row = rows[0];
        const nextIssue = parseInt(row.issue) + 1;
        let pred = row.deep_prediction || row.next_prediction;
        
        // 如果数据库没存，但内存里算出来了，就用内存的
        if (!pred && CALC_TASK.bestPrediction) pred = CALC_TASK.bestPrediction;
        
        if (typeof pred === 'string') {
            try { pred = JSON.parse(pred); } catch(e) { pred = {}; }
        }
        if (!pred) return ctx.reply('暂无预测数据');

        const isCalculating = CALC_TASK.isRunning && CALC_TASK.phase === 1 && CALC_TASK.currentIssue == row.issue;
        const text = formatPredictionText(nextIssue, pred || {}, !isCalculating);
        
        ctx.reply(text, { parse_mode: 'Markdown' });
    });

    // 3. 深度演算
    bot.hears('🔭 深度演算', async (ctx) => {
        if (CALC_TASK.isRunning && CALC_TASK.phase === 2) return ctx.reply('正在计算中...');
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        if (!rows.length) return ctx.reply('无数据');
        const row = rows[0];

        let startPred = null;
        if (row.next_prediction) startPred = JSON.parse(row.next_prediction);

        CALC_TASK = {
            isRunning: true,
            phase: 2,
            startTime: Date.now(),
            targetDuration: DEEP_CALC_DURATION, // 使用设置的时长
            targetIterations: 20000000,
            currentIssue: row.issue,
            bestScore: -9999,
            bestPrediction: startPred,
            iterations: 0,
            historyCache: null 
        };
        ctx.reply(`🚀 **深度计算已启动**\n时长: ${DEEP_CALC_DURATION/3600000} 小时\n算法: 五行生克 + 智能杀号`, {parse_mode:'Markdown'});
    });

    // 4. 进度查询
    bot.hears('⏳ 计算进度', (ctx) => {
        if (!CALC_TASK.isRunning) return ctx.reply('💤 当前无活跃任务。');
        
        const now = Date.now();
        const timePct = Math.min(100, Math.floor(((now - CALC_TASK.startTime) / CALC_TASK.targetDuration) * 100));
        const bar = "🟩".repeat(Math.floor(timePct/10)) + "⬜".repeat(10 - Math.floor(timePct/10));
        const timeLeft = Math.ceil((CALC_TASK.targetDuration - (now - CALC_TASK.startTime)) / 60000);

        ctx.reply(`
🖥 **AI 算力监控**
第 ${parseInt(CALC_TASK.currentIssue) + 1} 期
------------------
${bar} ${timePct}%
迭代: ${CALC_TASK.iterations} 次
剩余: ${timeLeft} 分钟
最佳得分: ${CALC_TASK.bestScore.toFixed(0)}
        `);
    });

    // 5. 手动推送
    bot.hears(/手动发频道/, async (ctx) => {
        if (!CHANNEL_ID) return ctx.reply('无频道ID');
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            const row = rows[0];
            const nextIssue = parseInt(row.issue) + 1;
            
            let pred = row.deep_prediction || row.next_prediction;
            let title = row.deep_prediction ? '🚀 深度加强版' : '🏁 基础版';
            
            if (!pred) return ctx.reply('暂无数据');
            if (typeof pred === 'string') pred = JSON.parse(pred);

            const msgText = formatPredictionText(nextIssue, pred, title);
            await bot.telegram.sendMessage(CHANNEL_ID, msgText, { parse_mode: 'Markdown' });
            ctx.reply(`✅ 已手动推送：${title}`);
        } catch (e) { ctx.reply('发送失败: ' + e.message); }
    });

    // 6. 开关自动推送
    bot.hears(/自动推送/, (ctx) => {
        AUTO_SEND_ENABLED = !AUTO_SEND_ENABLED;
        ctx.reply(`自动推送: ${AUTO_SEND_ENABLED ? '✅ 开' : '❌ 关'}`, getMainMenu());
    });
    
    // 7. 历史走势
    bot.hears('📊 历史走势', async (ctx) => {
        const [rows] = await db.query('SELECT issue, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 10');
        let msg = '📉 **近期特码**\n\n';
        rows.forEach(r => msg += `\`${r.issue}期\` : **${r.special_code}** (${r.shengxiao})\n`);
        ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // 8. 删除记录
    bot.hears('🗑 删除记录', (ctx) => {
        userStates[ctx.from.id] = 'WAIT_DEL';
        ctx.reply('请输入要删除的期号:');
    });

    // --- 消息处理 ---
    bot.on(['text', 'channel_post'], async (ctx) => {
        const text = ctx.message?.text || ctx.channelPost?.text;
        if (!text) return;

        // 处理删除
        if (userStates[ctx.from.id] === 'WAIT_DEL' && ctx.chat.type === 'private') {
            await db.execute('DELETE FROM lottery_results WHERE issue = ?', [text]);
            userStates[ctx.from.id] = null;
            return ctx.reply(`✅ 第 ${text} 期已删除`, getMainMenu());
        }

        // 处理开奖录入
        const result = parseLotteryResult(text);
        if (result) {
            const { issue, flatNumbers, specialCode, shengxiao } = result;
            let initialPred = generateSinglePrediction([]); // 先生成初始数据
            const jsonNums = JSON.stringify(flatNumbers);
            const jsonPred = JSON.stringify(initialPred);
            
            try {
                await db.execute(`
                    INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, next_prediction, deep_prediction, open_date)
                    VALUES (?, ?, ?, ?, ?, NULL, NOW())
                    ON DUPLICATE KEY UPDATE numbers=?, special_code=?, shengxiao=?, next_prediction=?, deep_prediction=NULL, open_date=NOW()
                `, [issue, jsonNums, specialCode, shengxiao, jsonPred, jsonNums, specialCode, shengxiao, jsonPred]);

                // 启动计算任务
                CALC_TASK = {
                    isRunning: true,
                    phase: 1,
                    startTime: Date.now(),
                    targetDuration: DEEP_CALC_DURATION, // 默认跟随时长设置
                    targetIterations: 10000000,         
                    currentIssue: issue,
                    bestScore: -9999,
                    bestPrediction: initialPred,
                    iterations: 0,
                    historyCache: null
                };

                const msg = `✅ **第 ${issue} 期录入成功**\n\n🚀 自动启动计算任务\n时长: ${DEEP_CALC_DURATION/3600000} 小时\n算法: 五行生克 + 智能杀号`;
                if (ctx.chat.type === 'private') ctx.replyWithMarkdown(msg);
                else console.log(`频道录入: ${issue}`);
            } catch (err) { console.error(err); }
        }
    });

    bot.launch().catch(err => console.error(err));
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
}

module.exports = startBot;

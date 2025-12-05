// 核心修复：强制 Node.js 进程使用北京时间
process.env.TZ = 'Asia/Shanghai';

const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
// 引入 Utils (V5.5 算法已移植到此处)
const { parseLotteryResult, generateSinglePrediction, scorePrediction } = require('./utils');

// ==============================================================================
// 1. 全局配置与常量定义 (移植自文档 CONFIG)
// ==============================================================================

const SYSTEM_CONFIG = {
    NAME: "🇲🇴 新澳六合彩·天机",
    VERSION: "V5.5 Pro (Node.js版)",
    DEFAULT_DURATION: 3 * 60 * 60 * 1000, // 3小时
    TARGET_SIMS: 50000000, // 目标迭代次数
    BATCH_SIZE: 500,       // 每次Tick计算量
    ADMIN_ID: parseInt(process.env.ADMIN_ID),
    CHANNEL_ID: process.env.CHANNEL_ID
};

const EMOJI = {
    red: "🔴", blue: "🔵", green: "🟢",
    win: "✅", loss: "❌", wait: "⏳",
    chart: "📊", fire: "🔥", shield: "🛡️",
    rocket: "🚀", sync: "🔄", reset: "♻️",
    manage: "⚙️", history: "📜", preview: "👀",
    back: "🔙", gold: "💰", wood: "🌲",
    water: "💧", fire_element: "🔥", earth: "⛰️",
    star: "⭐", diamond: "💎", trophy: "🏆",
    bell: "🔔", home: "🏠"
};

// 核心任务状态机
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
    isProcessing: false, // 并发锁
    status: "IDLE" // IDLE, CALCULATING, DONE
};

const userStates = {}; // 用户状态管理

// ==============================================================================
// 2. 辅助工具类 (Formatter & Renderer)
// ==============================================================================

class Formatter {
    static safeParse(data) {
        if (!data) return null;
        if (typeof data === 'string') {
            try { return JSON.parse(data); } catch (e) { return null; }
        }
        return data;
    }

    static generateProgressBar(current, total, length = 10) {
        const percentage = total > 0 ? (current / total) : 0;
        const filled = Math.floor(length * percentage);
        const empty = length - filled;
        return "█".repeat(filled) + "░".repeat(empty);
    }

    static formatTimeLeft(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)));
        return `${hours}时 ${minutes}分 ${seconds}秒`;
    }
}

class MessageRenderer {
    static getMainMenu() {
        return Markup.keyboard([
            [`${EMOJI.preview} 下期预测`, `${EMOJI.wait} 计算进度`],
            [`${EMOJI.rocket} 深度演算`, `${EMOJI.chart} 历史走势`],
            [`${EMOJI.manage} 设置时长`, `${EMOJI.bell} 自动推送`], 
            [`${EMOJI.sync} 手动发频道`, `🗑 删除记录`]
        ]).resize();
    }

    static getDurationMenu() {
        return Markup.inlineKeyboard([
            [Markup.button.callback('⏱️ 30 分钟', 'set_dur_0.5'), Markup.button.callback('⏱️ 1 小时', 'set_dur_1')],
            [Markup.button.callback('⏱️ 3 小时 (标准)', 'set_dur_3'), Markup.button.callback('⏱️ 5 小时', 'set_dur_5')],
            [Markup.button.callback('⏱️ 10 小时 (极限)', 'set_dur_10')]
        ]);
    }

    // [核心] V5.5 Pro 风格渲染器
    static renderPreview(issue, pred, isFinalOrTitle = false) {
        if (!pred) return "❌ 预测数据为空，请重试。";

        let title = typeof isFinalOrTitle === 'string' ? isFinalOrTitle : 
            (isFinalOrTitle ? `🏁 第 ${issue} 期 最终决策` : `🧠 第 ${issue} 期 AI 演算中...`);

        // 1. 一肖一码 (网格显示)
        let zodiacBestDisplay = "暂无数据";
        if (pred.zodiac_one_code && Array.isArray(pred.zodiac_one_code)) {
            const lines = [];
            // 每行4个
            for (let i = 0; i < pred.zodiac_one_code.length; i += 4) {
                const lineContent = pred.zodiac_one_code.slice(i, i + 4).map(item => {
                    return `${item.zodiac}:${String(item.num).padStart(2,'0')}${EMOJI[item.color] || ""}`;
                }).join("  ");
                lines.push(lineContent);
            }
            zodiacBestDisplay = lines.join("\n");
        }

        // 2. 精选平码 (平铺)
        let normalDisplay = "暂无数据";
        if (pred.normal_numbers && Array.isArray(pred.normal_numbers)) {
            normalDisplay = pred.normal_numbers.map(num => 
                `${String(num.num).padStart(2,'0')}(${num.zodiac}${EMOJI[num.color]||''})`
            ).join("  ");
        }

        // 3. 特码前五 (平铺)
        let specialDisplay = "暂无数据";
        if (pred.special_numbers && Array.isArray(pred.special_numbers)) {
            specialDisplay = pred.special_numbers.map(num => 
                `${String(num.num).padStart(2,'0')}${EMOJI[num.color]||''}`
            ).join("  ");
        }

        // 4. 其他数据
        const tailsStr = (pred.rec_tails && Array.isArray(pred.rec_tails)) ? pred.rec_tails.join('.') : '?';
        const killInfo = (pred.kill_zodiacs && pred.kill_zodiacs.length > 0) ? `\n🚫 **绝杀三肖**: ${pred.kill_zodiacs.join(' ')}` : '';
        const headStr = (pred.hot_head !== undefined) ? `主 ${pred.hot_head} 头 | 防 ${pred.fang_head} 头` : '?';
        
        // 5. 波色
        const waveMap = { red: '🔴红', blue: '🔵蓝', green: '🟢绿' };

        return `
🔮 <b>${SYSTEM_CONFIG.NAME}</b>
${title}
────────────────

${EMOJI.trophy} <b>一肖一码 (全阵)</b>
${zodiacBestDisplay}

${EMOJI.diamond} <b>精选平码 (六码)</b>
${normalDisplay}

${EMOJI.star} <b>特码前五 (高分)</b>
${specialDisplay}

${EMOJI.fire} <b>生肖推荐</b>
主推: ${Array.isArray(pred.zhu_san) ? pred.zhu_san.join(" ") : "?"}
五肖: ${Array.isArray(pred.liu_xiao) ? pred.liu_xiao.join(" ") : "?"}

🔢 <b>围捕数据</b>
头数: ${headStr}
尾数: ${tailsStr} 尾
波色: ${waveMap[pred.zhu_bo] || '?'} (防${waveMap[pred.fang_bo] || '?'})
形态: ${pred.da_xiao} / ${pred.dan_shuang}${killInfo}
────────────────
${EMOJI.chart} <b>算法统计</b>
迭代: ${CALC_TASK.iterations} 次
版本: ${SYSTEM_CONFIG.VERSION}
`.trim();
    }

    static renderProgress(task) {
        if (!task.isRunning) return "💤 当前无活跃任务";
        
        const now = Date.now();
        const elapsed = now - task.startTime;
        const totalDuration = task.targetDuration;
        
        const timePct = Math.min(100, (elapsed / totalDuration) * 100);
        const iterPct = Math.min(100, (task.iterations / task.targetIterations) * 100);
        const totalPct = Math.min(timePct, iterPct); // 取最小值作为真实进度
        
        const bar = Formatter.generateProgressBar(totalPct, 100);
        const timeLeft = Math.max(0, totalDuration - elapsed);

        return `
${EMOJI.rocket} <b>AI 算力监控</b>
────────────────
🎯 目标期号: ${parseInt(task.currentIssue) + 1}
⚡ 当前阶段: Phase ${task.phase}
🔄 迭代次数: ${task.iterations} / ${task.targetIterations}
⏱️ 运行时间: ${Formatter.formatTimeLeft(elapsed)}
📊 总体进度: ${totalPct.toFixed(1)}%
${bar}
⏳ 预计剩余: ${Formatter.formatTimeLeft(timeLeft)}
🏆 当前最佳分: ${task.bestScore.toFixed(2)}
`.trim();
    }
}

// ==============================================================================
// 3. Bot 主程序
// ==============================================================================

function startBot() {
    const bot = new Telegraf(process.env.BOT_TOKEN);
    let AUTO_SEND = true;

    // --- 后台计算任务 (Heartbeat) ---
    setInterval(async () => {
        if (!CALC_TASK.isRunning || CALC_TASK.isProcessing) return;

        const now = Date.now();
        const elapsed = now - CALC_TASK.startTime;
        const isTimeUp = elapsed >= CALC_TASK.targetDuration;
        const isIterUp = CALC_TASK.iterations >= CALC_TASK.targetIterations;

        // 任务完成逻辑
        if (isTimeUp && isIterUp) {
            CALC_TASK.isProcessing = true; // 上锁
            try {
                const nextIssue = parseInt(CALC_TASK.currentIssue) + 1;
                const jsonPred = JSON.stringify(CALC_TASK.bestPrediction);

                // Phase 1 完成 -> 发送频道 -> 转 Phase 2
                if (CALC_TASK.phase === 1) {
                    console.log(`[Phase 1 Done] ${CALC_TASK.currentIssue}`);
                    
                    await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
                    
                    if (AUTO_SEND && SYSTEM_CONFIG.CHANNEL_ID && CALC_TASK.bestPrediction) {
                        const msg = MessageRenderer.renderPreview(nextIssue, CALC_TASK.bestPrediction, true);
                        await bot.telegram.sendMessage(SYSTEM_CONFIG.CHANNEL_ID, msg, { parse_mode: 'HTML' });
                        bot.telegram.sendMessage(SYSTEM_CONFIG.ADMIN_ID, `✅ 第 ${nextIssue} 期 Phase 1 已推送。启动 Phase 2。`);
                    }

                    CALC_TASK.phase = 2;
                    CALC_TASK.startTime = Date.now();
                    CALC_TASK.iterations = 0;
                    CALC_TASK.targetDuration = SYSTEM_CONFIG.DEFAULT_DURATION; 
                    CALC_TASK.isProcessing = false; 
                    return;
                } 
                // Phase 2 完成 -> 结束
                else {
                    console.log(`[Phase 2 Done] ${CALC_TASK.currentIssue}`);
                    CALC_TASK.isRunning = false;
                    CALC_TASK.status = "DONE";
                    
                    await db.execute('UPDATE lottery_results SET deep_prediction=? WHERE issue=?', [jsonPred, CALC_TASK.currentIssue]);
                    
                    bot.telegram.sendMessage(SYSTEM_CONFIG.ADMIN_ID, `✅ 第 ${nextIssue} 期 深度计算(Phase 2) 完成！`, {
                        parse_mode: 'HTML',
                        ...Markup.inlineKeyboard([Markup.button.callback('👁️ 查看结果', 'show_deep_final')])
                    });
                    
                    CALC_TASK.isProcessing = false;
                    return;
                }
            } catch (e) {
                console.error("Task Error:", e);
                CALC_TASK.isProcessing = false;
            }
            return;
        }

        // 计算循环 (V5.5 逻辑)
        try {
            if (!CALC_TASK.historyCache) {
                const [rows] = await db.query('SELECT numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 60');
                CALC_TASK.historyCache = rows;
            }
            // 每次 Tick 跑 BATCH_SIZE 次
            for(let i=0; i<SYSTEM_CONFIG.BATCH_SIZE; i++) {
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
    // 4. 交互处理 (Command Handlers)
    // ============================

    // 显示下期预测
    const handlePreview = async (ctx, isRefresh = false) => {
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            if (!rows.length) return ctx.reply('❌ 暂无历史数据');
            
            const row = rows[0];
            const nextIssue = parseInt(row.issue) + 1;
            
            // 优先取深度，其次基础，最后内存
            let pred = Formatter.safeParse(row.deep_prediction) || Formatter.safeParse(row.next_prediction);
            if (!pred && CALC_TASK.bestPrediction) pred = CALC_TASK.bestPrediction;
            
            if (!pred) return ctx.reply(`${EMOJI.wait} 数据计算中，请稍候...`);

            const isCalculating = CALC_TASK.isRunning && CALC_TASK.currentIssue == row.issue;
            const text = MessageRenderer.renderPreview(nextIssue, pred, !isCalculating);
            
            const extra = {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    Markup.button.callback(`${EMOJI.sync} 刷新数据`, 'refresh_pred')
                ])
            };

            if (isRefresh) {
                await ctx.editMessageText(text, extra).catch(()=>{});
                await ctx.answerCbQuery('已刷新');
            } else {
                await ctx.reply(text, extra);
            }
        } catch (e) { console.error(e); }
    };

    // 显示计算进度
    const handleProgress = async (ctx, isRefresh = false) => {
        const text = MessageRenderer.renderProgress(CALC_TASK);
        const extra = {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                Markup.button.callback(`${EMOJI.sync} 刷新进度`, 'refresh_prog')
            ])
        };
        
        if (isRefresh) {
            await ctx.editMessageText(text, extra).catch(()=>{});
            await ctx.answerCbQuery('更新成功');
        } else {
            await ctx.reply(text, extra);
        }
    };

    // 深度演算控制
    const handleDeepCalc = async (ctx) => {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        const row = rows[0];
        const nextIssue = parseInt(row.issue) + 1;

        // 正在运行
        if (CALC_TASK.isRunning && CALC_TASK.currentIssue == row.issue) {
            return handleProgress(ctx, false);
        }

        // 已经有深度结果
        if (row.deep_prediction) {
            return ctx.reply(MessageRenderer.renderPreview(nextIssue, Formatter.safeParse(row.deep_prediction), "🚀 深度版 (已完成)"), {parse_mode:'HTML'});
        }

        // 手动启动
        let startPred = Formatter.safeParse(row.next_prediction);
        CALC_TASK = {
            isRunning: true,
            phase: 2,
            startTime: Date.now(),
            targetDuration: SYSTEM_CONFIG.DEFAULT_DURATION,
            targetIterations: SYSTEM_CONFIG.TARGET_SIMS,
            currentIssue: row.issue,
            bestScore: -9999,
            bestPrediction: startPred,
            iterations: 0,
            historyCache: null,
            isProcessing: false,
            status: "CALCULATING"
        };
        ctx.reply(`🚀 **深度计算已手动启动**\n🎯 目标：${nextIssue} 期\n⏱️ 时长：${SYSTEM_CONFIG.DEFAULT_DURATION/3600000} 小时`);
    };

    // 历史走势
    const handleHistory = async (ctx) => {
        const [rows] = await db.query('SELECT issue, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 15');
        let msg = `<b>${EMOJI.chart} 近15期特码走势</b>\n────────────────\n`;
        rows.forEach(r => {
            const attr = require('./utils').parseLotteryResult(`Test\nTest\nTest\nTest\nTest\nTest\n${r.shengxiao}`); // 借用一下逻辑或直接查库
            // 这里简单拼装，因为 utils.js 里的 parse 主要是解析文本
            // 我们直接用数据库里的 shengxiao
            msg += `第 <b>${r.issue}</b> 期 : <b>${String(r.special_code).padStart(2,'0')}</b> (${r.shengxiao})\n`;
        });
        ctx.reply(msg, { parse_mode: 'HTML' });
    };

    // --- Listeners ---

    bot.hears(new RegExp(`${EMOJI.preview}|下期预测`), (ctx) => handlePreview(ctx));
    bot.action('refresh_pred', (ctx) => handlePreview(ctx, true));

    bot.hears(new RegExp(`${EMOJI.wait}|计算进度`), (ctx) => handleProgress(ctx));
    bot.action('refresh_prog', (ctx) => handleProgress(ctx, true));

    bot.hears(new RegExp(`${EMOJI.rocket}|深度演算`), (ctx) => handleDeepCalc(ctx));
    bot.action('show_deep_final', (ctx) => handleDeepCalc(ctx));

    bot.hears(new RegExp(`${EMOJI.chart}|历史走势`), (ctx) => handleHistory(ctx));

    bot.hears(new RegExp(`${EMOJI.manage}|设置时长`), (ctx) => ctx.reply('请选择计算时长:', MessageRenderer.getDurationMenu()));
    bot.action(/set_dur_([\d\.]+)/, (ctx) => {
        const h = parseFloat(ctx.match[1]);
        SYSTEM_CONFIG.DEFAULT_DURATION = h * 3600000;
        ctx.editMessageText(`✅ 默认时长已更新为: ${h} 小时`);
    });

    bot.hears(new RegExp(`${EMOJI.sync}|手动发频道`), async (ctx) => {
        if (!SYSTEM_CONFIG.CHANNEL_ID) return ctx.reply('❌ 未配置频道ID');
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        const nextIssue = parseInt(rows[0].issue) + 1;
        let pred = Formatter.safeParse(rows[0].deep_prediction) || Formatter.safeParse(rows[0].next_prediction);
        if (!pred) return ctx.reply('❌ 暂无预测数据');
        
        await bot.telegram.sendMessage(SYSTEM_CONFIG.CHANNEL_ID, MessageRenderer.renderPreview(nextIssue, pred, `📡 手动推送`), {parse_mode:'HTML'});
        ctx.reply('✅ 已发送至频道');
    });

    bot.hears(new RegExp(`${EMOJI.bell}|自动推送`), (ctx) => {
        AUTO_SEND = !AUTO_SEND;
        ctx.reply(`自动推送: ${AUTO_SEND ? '✅ 开' : '❌ 关'}`, MessageRenderer.getMainMenu());
    });

    bot.hears(/删除记录/, (ctx) => {
        if (ctx.from) {
            userStates[ctx.from.id] = 'WAIT_DEL';
            ctx.reply('请输入要删除的期号 (如 2024001):');
        }
    });

    // --- 中间件与启动 ---
    bot.use(async (ctx, next) => {
        if (ctx.channelPost && String(ctx.chat.id) === String(SYSTEM_CONFIG.CHANNEL_ID)) return next();
        if (ctx.from && ctx.from.id === SYSTEM_CONFIG.ADMIN_ID) return next();
    });

    bot.start((ctx) => {
        if (ctx.from) userStates[ctx.from.id] = null;
        ctx.reply(`🤖 <b>${SYSTEM_CONFIG.NAME}</b>\n版本: ${SYSTEM_CONFIG.VERSION}\n系统就绪。`, {
            parse_mode: 'HTML',
            ...MessageRenderer.getMainMenu()
        });
    });

    // 开奖录入监听
    bot.on(['text', 'channel_post'], async (ctx) => {
        const text = ctx.message?.text || ctx.channelPost?.text;
        if (!text) return;

        // 删除逻辑
        if (ctx.from && userStates[ctx.from.id] === 'WAIT_DEL' && ctx.chat.type === 'private') {
            await db.execute('DELETE FROM lottery_results WHERE issue = ?', [text]);
            userStates[ctx.from.id] = null;
            return ctx.reply(`✅ 第 ${text} 期已删除`, MessageRenderer.getMainMenu());
        }

        // 解析录入
        const result = parseLotteryResult(text);
        if (result) {
            const { issue, flatNumbers, specialCode, shengxiao } = result;
            const initPred = generateSinglePrediction([]); 
            const jsonNums = JSON.stringify(flatNumbers);
            const jsonPred = JSON.stringify(initPred);
            
            try {
                await db.execute(`
                    INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, next_prediction, deep_prediction, open_date)
                    VALUES (?, ?, ?, ?, ?, NULL, NOW())
                    ON DUPLICATE KEY UPDATE numbers=?, special_code=?, shengxiao=?, next_prediction=?, deep_prediction=NULL, open_date=NOW()
                `, [issue, jsonNums, specialCode, shengxiao, jsonPred, jsonNums, specialCode, shengxiao, jsonPred]);

                // 启动任务
                CALC_TASK = {
                    isRunning: true,
                    phase: 1,
                    startTime: Date.now(),
                    targetDuration: SYSTEM_CONFIG.DEFAULT_DURATION,
                    targetIterations: SYSTEM_CONFIG.TARGET_SIMS,
                    currentIssue: issue,
                    bestScore: -9999,
                    bestPrediction: initPred,
                    iterations: 0,
                    historyCache: null,
                    isProcessing: false,
                    status: "CALCULATING"
                };

                const h = SYSTEM_CONFIG.DEFAULT_DURATION / 3600000;
                const msg = `✅ <b>第 ${issue} 期录入成功</b>\n\n🚀 自动启动 V5.5 Pro 预测任务\nPhase 1: ${h}小时\nPhase 2: ${h}小时\n算法: 生肖转移+波色加权+一肖一码`;
                
                if (ctx.chat?.type === 'private') ctx.reply(msg, {parse_mode:'HTML'});
                else console.log(`频道录入: ${issue}`);
            } catch (err) { console.error(err); }
        }
    });

    bot.launch().catch(err => console.error("Bot Launch Error:", err));
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
}

module.exports = startBot;

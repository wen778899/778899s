// 核心修复：强制 Node.js 进程使用北京时间
process.env.TZ = 'Asia/Shanghai';

const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const db = require('./db');
// 引入 V60.0 算法库
const { parseLotteryResult, generateSinglePrediction } = require('./utils');

// --- 全局配置 ---
let AUTO_SEND_ENABLED = true;
// [配置] V60.0 算法高效，1小时足够，如需更深可调大
let DEEP_CALC_DURATION = 1 * 60 * 60 * 1000; 
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

// [修复] 安全解析号码数组 (兼容 JSON 和 逗号分隔字符串)
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
        ['🔮 下期预测', '📊 历史走势'],
        [`${autoSendIcon} 自动推送`, '🔄 立即抓取'],
        ['📡 手动发频道', '🗑 删除记录']
    ]).resize();
}

function getDurationMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('30 分钟', 'set_dur_0.5'), Markup.button.callback('1 小时', 'set_dur_1')],
        [Markup.button.callback('3 小时', 'set_dur_3'), Markup.button.callback('5 小时', 'set_dur_5')],
        [Markup.button.callback('10 小时 (极限)', 'set_dur_10')]
    ]);
}

// [核心] V60.0 文案格式化
function formatPredictionText(issue, pred, isFinal = false) {
    const waveMap = { red: '🔴 红波', blue: '🔵 蓝波', green: '🟢 绿波' };
    const emojiMap = { red: '🔴', blue: '🔵', green: '🟢' };
    
    // 标题：根据状态显示
    let title = isFinal 
        ? `🏁 第 ${issue} 期 最终决策 (V60.0 AI)` 
        : `🧠 第 ${issue} 期 混合智能演算中...`;
    
    const safeJoin = (arr) => arr ? arr.join(' ') : '?';

    // 一码阵
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

    // 平码 & 特码
    let normalStr = '⏳';
    if (pred.normal_numbers) normalStr = pred.normal_numbers.map(n => `${String(n.num).padStart(2,'0')}(${n.zodiac})`).join('  ');

    let specialStr = '⏳';
    if (pred.special_numbers) specialStr = pred.special_numbers.map(n => `${String(n.num).padStart(2,'0')}${emojiMap[n.color]||''}`).join('  ');

    // 绝杀 & 尾数
    const killInfo = (pred.kill_zodiacs && pred.kill_zodiacs.length > 0) ? `\n🚫 **绝杀三肖**: ${pred.kill_zodiacs.join(' ')}` : '';
    const tailsStr = (pred.rec_tails && Array.isArray(pred.rec_tails)) ? pred.rec_tails.join('.') : '?';
    const headStr = (pred.hot_head !== undefined) ? `主 ${pred.hot_head} 头 | 防 ${pred.fang_head} 头` : '?';

    // 状态栏
    let statusLine = "";
    if (isFinal) {
        statusLine = "✅ 数据库已更新 | 等待开奖验证";
    } else {
        // 动态显示的迭代次数
        const iter = CALC_TASK.iterations ? CALC_TASK.iterations.toLocaleString() : '0';
        statusLine = `🔄 深度迭代: ${iter} 次 (四维引擎运行中)`;
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

// 格式化开奖结果 (播报用)
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

// --- 核心：全量重算逻辑 (V60.0) ---
async function recalculatePrediction(bot, ADMIN_ID, latestIssue, latestResult = null) {
    console.log(`[Calc] 开始 V60.0 混合智能计算...`);
    
    // 1. 读取所有历史数据
    const [allHistory] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
    
    if (allHistory.length < 10) return;

    // 2. 生成预测 (调用 utils.js 中的 V60 算法)
    const prediction = generateSinglePrediction(allHistory);
    const jsonPred = JSON.stringify(prediction);

    // 3. 存入数据库
    await db.execute('UPDATE lottery_results SET next_prediction=?, deep_prediction=? WHERE issue=?', [jsonPred, jsonPred, latestIssue]);

    // 4. 推送消息
    if (AUTO_SEND_ENABLED && process.env.CHANNEL_ID) {
        // 先发开奖结果
        if (latestResult) {
            const resultMsg = formatLotteryResult(latestIssue, latestResult.numbers, latestResult.special, latestResult.shengxiao);
            await bot.telegram.sendMessage(process.env.CHANNEL_ID, resultMsg, { parse_mode: 'Markdown' });
        }
        
        // 再发预测
        const nextIssue = parseInt(latestIssue) + 1;
        const msg = formatPredictionText(nextIssue, prediction, true); // true 表示是最终版
        await bot.telegram.sendMessage(process.env.CHANNEL_ID, msg, { parse_mode: 'Markdown' });
    }
    
    if (ADMIN_ID) {
        bot.telegram.sendMessage(ADMIN_ID, `✅ V60.0 模型已更新 (样本: ${allHistory.length})`);
    }
}

// --- 自动抓取逻辑 ---
async function fetchAndProcessLottery(bot, ADMIN_ID, isManual = false) {
    try {
        console.log(`[Fetch] 请求 API...`);
        const res = await axios.get(LOTTERY_API_URL, { timeout: 20000 });
        
        if (res.data && res.data.code === 200 && res.data.data && Array.isArray(res.data.data)) {
            const list = res.data.data;
            let newCount = 0;
            let latestIssue = "";
            let latestData = null;
            
            // 倒序补录 (旧->新)
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
                    latestData = { numbers: jsonNums, special: specialCode, shengxiao: shengxiao };
                }
            }

            if (newCount > 0) {
                // 有新数据 -> 触发全量重算
                await recalculatePrediction(bot, ADMIN_ID, latestIssue, latestData);

                if (ADMIN_ID && isManual) {
                    bot.telegram.sendMessage(ADMIN_ID, `✅ **补录完成**\n共 ${newCount} 期。\n最新: 第 ${latestIssue} 期`);
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

    // 定时器: 窗口抓取 (21:33 - 21:45)
    setInterval(() => {
        const now = new Date();
        const bjtStr = now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
        const bjtDate = new Date(bjtStr);
        const hour = bjtDate.getHours();
        const minute = bjtDate.getMinutes();
        const todayStr = bjtStr.split(',')[0];

        if (hour === 21 && minute >= 33 && minute <= 45) {
            if (LAST_SUCCESS_DATE === todayStr) return;
            fetchAndProcessLottery(bot, ADMIN_ID, false);
        }
    }, 60 * 1000);

    // --- 交互 ---
    
    // [1] 下期预测
    bot.hears('🔮 下期预测', async (ctx) => {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        if (!rows.length) return ctx.reply('暂无数据');
        const row = rows[0];
        
        let pred = safeParse(row.deep_prediction) || safeParse(row.next_prediction);
        
        if (!pred) {
            // 如果没数据，现场算
            await recalculatePrediction(bot, null, row.issue);
            const [newRows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            pred = safeParse(newRows[0].next_prediction);
        }
        if (!pred) return ctx.reply('计算失败');
        
        // 发送消息 (不是最终版，因为是手动查询)
        ctx.reply(formatPredictionText(parseInt(row.issue)+1, pred, false), { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])
        });
    });
    
    // [2] 刷新按钮
    bot.action('refresh_pred', async (ctx) => {
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            const row = rows[0];
            let pred = safeParse(row.deep_prediction) || safeParse(row.next_prediction);
            if (!pred) return ctx.answerCbQuery('无数据');
            
            // 为了让界面有变化，我们这里触发一次微调计算 (可选，或者直接显示库里的)
            // 这里选择直接显示库里的，因为V60是确定性算法
            
            const text = formatPredictionText(parseInt(row.issue)+1, pred, false);
            
            // 强制更新 (忽略 not modified)
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown', 
                ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])
            }).catch(()=>{});
            
            ctx.answerCbQuery('已刷新');
        } catch(e) {}
    });

    // [3] 历史走势
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

    bot.hears(/手动发频道/, async (ctx) => {
        if (!CHANNEL_ID) return ctx.reply('无频道ID');
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
        let pred = safeParse(rows[0].next_prediction);
        if (!pred) return ctx.reply('无数据');
        await bot.telegram.sendMessage(CHANNEL_ID, formatPredictionText(parseInt(rows[0].issue)+1, pred, true), {parse_mode:'Markdown'});
        ctx.reply('已发送');
    });

    // 启动
    bot.use(async (ctx, next) => {
        if(ctx.channelPost && String(ctx.chat.id)===String(CHANNEL_ID)) return next();
        if(ctx.from && ctx.from.id===ADMIN_ID) return next();
    });
    bot.start((ctx) => { 
        if(ctx.from) userStates[ctx.from.id]=null; 
        ctx.reply('🤖 V60.0 Hybrid AI Ready', getMainMenu()); 
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
            
            ctx.reply('✅ 手动录入成功，正在重算...');
            await recalculatePrediction(bot, ADMIN_ID, issue, {numbers:jsonNums, special:specialCode, shengxiao});
        }
    });

    bot.launch().catch(err => console.error("Bot Launch Error:", err));
    process.once('SIGINT', ()=>bot.stop()); process.once('SIGTERM', ()=>bot.stop());
    return bot;
}

module.exports = startBot;

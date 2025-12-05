// 核心修复：强制 Node.js 进程使用北京时间
process.env.TZ = 'Asia/Shanghai';

const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const db = require('./db');
const { parseLotteryResult, generateSinglePrediction, trainModel } = require('./utils');

// --- 全局配置 ---
let AUTO_SEND_ENABLED = true;
const LOTTERY_API_URL = 'https://history.macaumarksix.com/history/macaujc2/y/2025'; 

// 抓取状态记录
let LAST_SUCCESS_DATE = null; 
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
        ['🔮 下期预测', '📊 历史走势'],
        [`${autoSendIcon} 自动推送`, '🔄 立即抓取'],
        ['📡 手动发频道', '🗑 删除记录']
    ]).resize();
}

// 格式化文案
function formatPredictionText(issue, pred) {
    const waveMap = { red: '🔴 红波', blue: '🔵 蓝波', green: '🟢 绿波' };
    const emojiMap = { red: '🔴', blue: '🔵', green: '🟢' };
    
    // 元数据：显示统计样本
    const meta = pred.meta || {};
    const sampleInfo = meta.sample_size 
        ? `🔍 历史样本: 上期开[${meta.last_zodiac}] 共出现 ${meta.sample_size} 次` 
        : '🔍 正在建立统计模型...';

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
🧠 **第 ${issue} 期 大数据统计决策**
${sampleInfo}
━━━━━━━━━━━━━━
🐭 **一肖一码 (全阵)**
${zodiacGrid}

💎 **精选平码 (六码)**
${normalStr}

⭐ **特码前五 (高分)**
${specialStr}

🔥 **五肖中特**
${pred.liu_xiao.join(' ')} (主: ${pred.zhu_san.join(' ')})

🔢 **围捕数据**
头数：${headStr}
尾数：${tailsStr} 尾
波色：${waveMap[pred.zhu_bo]} (防${waveMap[pred.fang_bo]})
形态：${pred.da_xiao} / ${pred.dan_shuang}${killInfo}
━━━━━━━━━━━━━━
✅ 基于历史概率统计 | 非随机生成
`.trim();
}

// --- 核心：全量重算逻辑 ---
// 每次有新数据，或者手动触发时，都重新读取所有历史，重新训练模型，生成最新预测
async function recalculatePrediction(bot, ADMIN_ID, latestIssue) {
    console.log(`[Calc] 开始全量统计计算...`);
    
    // 1. 读取所有历史数据 (用于训练)
    const [allHistory] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
    
    if (allHistory.length < 10) {
        console.log('[Calc] 数据量不足，跳过计算');
        return;
    }

    // 2. 生成预测
    // generateSinglePrediction 内部会先调用 trainModel 遍历 allHistory
    const prediction = generateSinglePrediction(allHistory);
    const jsonPred = JSON.stringify(prediction);

    // 3. 存入数据库 (更新最新一期的 next_prediction 字段)
    // 这里的 latestIssue 是指"刚开完的这一期"，预测内容是针对"下一期"的
    await db.execute('UPDATE lottery_results SET next_prediction=?, deep_prediction=? WHERE issue=?', [jsonPred, jsonPred, latestIssue]);

    console.log(`[Calc] 计算完成，预测已更新`);

    // 4. 推送
    if (AUTO_SEND_ENABLED && process.env.CHANNEL_ID) {
        const nextIssue = parseInt(latestIssue) + 1;
        const msg = formatPredictionText(nextIssue, prediction);
        await bot.telegram.sendMessage(process.env.CHANNEL_ID, msg, { parse_mode: 'Markdown' });
    }
    
    if (ADMIN_ID) {
        bot.telegram.sendMessage(ADMIN_ID, `✅ 预测模型已更新 (样本数: ${allHistory.length})`);
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
            let latestOpenCode = "";
            
            // 倒序补录
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
                    latestOpenCode = item.openCode;
                }
            }

            if (newCount > 0) {
                // 有新数据 -> 触发全量重算
                await recalculatePrediction(bot, ADMIN_ID, latestIssue);

                if (ADMIN_ID) {
                    const msg = isManual 
                        ? `✅ **补录完成**\n共 ${newCount} 期。\n最新: 第 ${latestIssue} 期`
                        : `🎉 **自动更新**\n第 ${latestIssue} 期\n号码: ${latestOpenCode}`;
                    bot.telegram.sendMessage(ADMIN_ID, msg, { parse_mode: 'Markdown' });
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

    // 定时器: 窗口抓取 (每分钟)
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
        let pred = safeParse(row.deep_prediction) || safeParse(row.next_prediction);
        
        if (!pred) {
            // 如果还没算出来，现场算一次
            await recalculatePrediction(bot, null, row.issue);
            // 再查一次
            const [newRows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            pred = safeParse(newRows[0].next_prediction);
        }
        
        if (!pred) return ctx.reply('计算失败');
        
        ctx.reply(formatPredictionText(parseInt(row.issue)+1, pred), { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])
        });
    });
    
    bot.action('refresh_pred', async (ctx) => {
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            const row = rows[0];
            let pred = safeParse(row.deep_prediction) || safeParse(row.next_prediction);
            if (!pred) return ctx.answerCbQuery('无数据');
            await ctx.editMessageText(formatPredictionText(parseInt(row.issue)+1, pred), {
                parse_mode: 'Markdown', 
                ...Markup.inlineKeyboard([Markup.button.callback('🔄 刷新数据', 'refresh_pred')])
            }).catch(()=>{});
            ctx.answerCbQuery('已刷新');
        } catch(e) {}
    });

    bot.hears('📊 历史走势', async (ctx) => {
        const [rows] = await db.query('SELECT issue, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 15');
        let msg = '📉 **近期特码走势**\n━━━━━━━━━━━━━━\n';
        rows.forEach(r => msg += `\`${r.issue}期\` : **${String(r.special_code).padStart(2,'0')}** (${r.shengxiao})\n`);
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
        await bot.telegram.sendMessage(CHANNEL_ID, formatPredictionText(parseInt(rows[0].issue)+1, pred), {parse_mode:'Markdown'});
        ctx.reply('已发送');
    });

    // 启动
    bot.use(async (ctx, next) => {
        if(ctx.channelPost && String(ctx.chat.id)===String(CHANNEL_ID)) return next();
        if(ctx.from && ctx.from.id===ADMIN_ID) return next();
    });
    bot.start((ctx) => { 
        if(ctx.from) userStates[ctx.from.id]=null; 
        ctx.reply('🤖 V20.0 纯统计版 Ready', getMainMenu()); 
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
            await recalculatePrediction(bot, ADMIN_ID, issue);
        }
    });

    bot.launch().catch(err => console.error("Bot Launch Error:", err));
    process.once('SIGINT', ()=>bot.stop()); process.once('SIGTERM', ()=>bot.stop());
    return bot;
}

module.exports = startBot;

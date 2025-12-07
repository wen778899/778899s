// 核心修复：强制 Node.js 进程使用北京时间
process.env.TZ = 'Asia/Shanghai';

const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const db = require('./db');
// 引入 V12.3 引擎
const { CONFIG, PredictionEngine, parseLotteryResult } = require('./utils');

const LOTTERY_API_URL = 'https://history.macaumarksix.com/history/macaujc2/y/2025'; 
let LAST_SUCCESS_DATE = null; 
let AUTO_SEND_ENABLED = true;
const userStates = {};

// --- HTML 渲染器 (适配 V12.3 样式) ---
const EMOJI = CONFIG.EMOJI;

function renderPreview(prediction) {
    if (!prediction) return "❌ 预测数据为空，请重试";

    const zodiacMain = prediction.zodiac?.main || [];
    const zodiacGuard = prediction.zodiac?.guard || [];
    
    // 一肖一码
    let zodiacBestDisplay = "暂无数据";
    if (prediction.zodiac_one_code && Array.isArray(prediction.zodiac_one_code)) {
        const lines = [];
        for (let i = 0; i < prediction.zodiac_one_code.length; i += 4) {
            const lineContent = prediction.zodiac_one_code.slice(i, i + 4).map(item => {
                return `${item.zodiac}:${String(item.num).padStart(2,'0')}${EMOJI[item.color] || ""}`;
            }).join("  ");
            lines.push(lineContent);
        }
        zodiacBestDisplay = lines.join("\n");
    }

    // 特码前五
    let specialDisplay = "暂无数据";
    if (prediction.specialNumbers && Array.isArray(prediction.specialNumbers)) {
        specialDisplay = prediction.specialNumbers.map((num, idx) => 
            `${idx+1}. ${num.number}(${num.zodiac}${EMOJI[num.color]||''})`
        ).join("\n");
    }

    // 平码
    let normalDisplay = "暂无数据";
    if (prediction.normalNumbers && Array.isArray(prediction.normalNumbers)) {
        normalDisplay = prediction.normalNumbers.map(num => 
            `${num.number}(${num.zodiac}${EMOJI[num.color]||''})`
        ).join("  ");
    }

    // 增强分析信息
    let advancedInfo = "";
    if (prediction.knnAnalysis && prediction.knnAnalysis.similarRecordsFound > 0) {
        advancedInfo += `\n${EMOJI.knn} <b>KNN分析</b>: 找到 ${prediction.knnAnalysis.similarRecordsFound} 条相似历史`;
    }

    return `
${EMOJI.fire} <b>${CONFIG.SYSTEM.NAME} - 预测结果</b>
${EMOJI.crown} <b>增强算法 (V12.3 Node)</b>
第 <b>${prediction.nextExpect}</b> 期
────────────────

${EMOJI.star} <b>生肖推荐</b>
主推: ${zodiacMain.join(" ") || "暂无"}
防守: ${zodiacGuard.join(" ") || "暂无"}

${EMOJI.diamond} <b>波色参考</b>
主${EMOJI[prediction.color?.main] || ""} / 防${EMOJI[prediction.color?.guard] || ""}

${EMOJI.rocket} <b>特码参考</b>
${specialDisplay}

<b>精选平码</b>
${normalDisplay}

────────────────
<b>${EMOJI.trophy} 一肖一码</b>
${zodiacBestDisplay}

────────────────
${EMOJI.target} <b>形态分析</b>
头数: ${prediction.head} | 形态: ${prediction.shape}${advancedInfo}

${EMOJI.chart_up} <b>置信度</b>: ${prediction.confidence}%
${EMOJI.clock} <b>生成时间</b>: ${new Date().toLocaleTimeString('zh-CN')}
${EMOJI.memory} <b>历史样本</b>: ${prediction.totalHistoryRecords} 期
`.trim();
}

function getMainMenu() {
    return Markup.keyboard([
        ['🔮 下期预测 (增强版)', '📊 历史走势'],
        ['📡 手动发频道', '🔄 立即抓取'],
        ['🗑 删除记录']
    ]).resize();
}

// 格式化开奖播报
function formatLotteryResult(issue, numbers, special, shengxiao) {
    let nums = [];
    try { nums = JSON.parse(numbers); } catch(e) { nums = numbers.split(',').map(Number); }
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

// --- 自动抓取 ---
async function fetchAndProcessLottery(bot, ADMIN_ID) {
    try {
        console.log(`[Fetch] 请求 API...`);
        const res = await axios.get(LOTTERY_API_URL, { timeout: 20000 });
        if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
            const list = res.data.data;
            let newCount = 0;
            let latestIssue = "";
            let latestResult = null;
            
            // 倒序遍历，确保旧数据先入库
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
                
                newCount++;
                // 记录最新一期的数据用于播报
                if (i === 0) { latestIssue = issue; latestResult = {numbers:jsonNums, special:specialCode, shengxiao}; }
            }

            if (newCount > 0) {
                // 有新数据，生成预测并存库
                const [history] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
                const prediction = await PredictionEngine.generate(history, CONFIG.DEFAULT_ALGO_WEIGHTS, "advanced");
                const jsonPred = JSON.stringify(prediction);
                await db.execute('UPDATE lottery_results SET next_prediction=?, deep_prediction=? WHERE issue=?', [jsonPred, jsonPred, latestIssue]);

                // 推送
                if (process.env.CHANNEL_ID) {
                    // 1. 开奖
                    const flatStr = JSON.parse(latestResult.numbers).map(n=>String(n).padStart(2,'0')).join(' ');
                    const resultMsg = `🎉 <b>第 ${latestIssue} 期 开奖结果</b>\n────────────────\n平码: ${flatStr}\n特码: <b>${String(latestResult.special).padStart(2,'0')}</b> (${latestResult.shengxiao})`;
                    await bot.telegram.sendMessage(process.env.CHANNEL_ID, resultMsg, {parse_mode:'HTML'});
                    
                    // 2. 预测
                    const msg2 = renderPreview(prediction);
                    await bot.telegram.sendMessage(process.env.CHANNEL_ID, msg2, {parse_mode:'HTML'});
                }
                if (ADMIN_ID) bot.telegram.sendMessage(ADMIN_ID, `✅ 补录 ${newCount} 期，预测已更新。`);
                
                LAST_SUCCESS_DATE = new Date().toDateString();
            } else {
                if (ADMIN_ID) bot.telegram.sendMessage(ADMIN_ID, "⚠️ 无新数据");
            }
        }
    } catch(e) { console.error(e); }
}

// --- Start Bot ---
function startBot() {
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const ADMIN_ID = parseInt(process.env.ADMIN_ID);
    
    // 定时抓取 (21:33-21:45)
    setInterval(() => {
        const now = new Date();
        const hour = now.getUTCHours() + 8;
        const minute = now.getUTCMinutes();
        if ((hour === 21 || hour === 45) && minute >= 33 && minute <= 45) {
             if (LAST_SUCCESS_DATE !== now.toDateString()) fetchAndProcessLottery(bot, ADMIN_ID);
        }
    }, 60000);

    bot.hears('🔮 下期预测 (增强版)', async (ctx) => {
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            if (!rows.length) return ctx.reply('无数据');
            
            let pred = safeParse(rows[0].next_prediction);
            if (!pred) {
                ctx.reply('⏳ 正在实时计算 V12.3 增强预测...');
                const [history] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
                pred = await PredictionEngine.generate(history, CONFIG.DEFAULT_ALGO_WEIGHTS, "advanced");
                // 存回去
                const jsonPred = JSON.stringify(pred);
                await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, rows[0].issue]);
            }
            
            ctx.reply(renderPreview(pred), { parse_mode: 'HTML' });
        } catch(e) { 
            console.error(e);
            ctx.reply("❌ 系统错误，请重试"); 
        }
    });

    bot.hears('🔄 立即抓取', (ctx) => {
        if (ctx.from.id !== ADMIN_ID) return;
        ctx.reply('⏳ 请求中...');
        fetchAndProcessLottery(bot, ADMIN_ID);
    });

    bot.hears('📊 历史走势', async (ctx) => {
        const [rows] = await db.query('SELECT issue, numbers, special_code, shengxiao FROM lottery_results ORDER BY issue DESC LIMIT 10');
        let msg = '<b>📉 近期走势</b>\n\n';
        rows.forEach(r => {
            const nums = JSON.parse(r.numbers).map(n=>String(n).padStart(2,'0')).join(' ');
            msg += `<b>${r.issue}</b>: ${nums} + <b>${String(r.special_code).padStart(2,'0')}</b> (${r.shengxiao})\n`;
        });
        ctx.reply(msg, { parse_mode: 'HTML' });
    });

    bot.hears('🗑 删除记录', (ctx) => {
        if(ctx.from.id===ADMIN_ID) {
            userStates[ctx.from.id]='WAIT_DEL';
            ctx.reply('请输入要删除的期号:');
        }
    });

    bot.on('text', async (ctx) => {
        const text = ctx.message.text;
        if (userStates[ctx.from.id]==='WAIT_DEL' && /^\d{7}$/.test(text)) {
            await db.execute('DELETE FROM lottery_results WHERE issue=?', [text]);
            userStates[ctx.from.id]=null;
            ctx.reply(`✅ 第 ${text} 期已删除`);
        } else if (parseLotteryResult(text)) {
             const res = parseLotteryResult(text);
             // 手动录入...
             const {issue, flatNumbers, specialCode, shengxiao} = res;
             const jsonNums = JSON.stringify(flatNumbers);
             await db.execute(`INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, open_date) VALUES (?,?,?,?,NOW())`, [issue, jsonNums, specialCode, shengxiao]);
             
             // 触发重算
             const [history] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
             const pred = await PredictionEngine.generate(history, CONFIG.DEFAULT_ALGO_WEIGHTS, "advanced");
             const jsonPred = JSON.stringify(pred);
             await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, issue]);
             ctx.reply('✅ 手动录入成功，预测已更新');
        }
    });

    // 启动保护
    (async () => {
        try {
            await bot.launch();
            console.log('🤖 V12.3 Node Port Ready');
        } catch (e) {
            console.error('❌ Bot launch failed:', e);
        }
    })();
    
    // 优雅退出
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
}

module.exports = startBot;

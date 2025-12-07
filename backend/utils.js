process.env.TZ = 'Asia/Shanghai';

const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const db = require('./db');
// 引入核心算法 (解构要准确)
const { generatePrediction, parseLotteryResult } = require('./utils');

const LOTTERY_API_URL = 'https://history.macaumarksix.com/history/macaujc2/y/2025'; 
let LAST_SUCCESS_DATE = null; 
const userStates = {};
const EMOJI = { red: "🔴", blue: "🔵", green: "🟢" };

// 辅助：JSON解析
function safeParse(str) { try { return JSON.parse(str); } catch(e) { return null; } }

// 辅助：HTML 渲染
function renderPreview(pred) {
    if (!pred) return "❌ 暂无预测数据 (请先录入历史)";

    const zodiacOneStr = pred.zodiac_one_code.map(i => 
        `${i.zodiac}${String(i.num).padStart(2,'0')}${EMOJI[i.color]||''}`
    ).join(' ');

    const specialStr = pred.specialNumbers.map((n, i) => 
        `${i+1}.${String(n.number).padStart(2,'0')}(${n.zodiac})`
    ).join(' ');

    const normalStr = pred.normalNumbers.map(n => 
        `${String(n.number).padStart(2,'0')}`
    ).join(' ');

    return `
🔥 <b>第 ${pred.nextExpect} 期 智能预测 (V15.0)</b>
────────────────
🐭 <b>一肖一码</b>
${zodiacOneStr}

⭐ <b>特码前五</b>
${specialStr}

💎 <b>精选平码</b>
${normalStr}

🔥 <b>五肖中特</b>
${pred.zodiac.main.join(' ')} (防: ${pred.zodiac.guard.join(' ')})

🚫 <b>绝杀三肖</b>: ${pred.kill_zodiacs.join(' ')}
🔢 <b>形态</b>: ${pred.head} / ${pred.shape}
────────────────
✅ 基于 ${pred.totalHistoryRecords} 期历史数据
`.trim();
}

function getMainMenu() {
    return Markup.keyboard([
        ['🔮 下期预测', '📊 历史走势'],
        ['🔄 立即抓取', '🗑 删除记录']
    ]).resize();
}

// 核心：抓取与计算
async function fetchLottery(bot, ADMIN_ID) {
    try {
        console.log('[Fetch] Checking...');
        const res = await axios.get(LOTTERY_API_URL, { timeout: 15000 });
        if (res.data && res.data.data && res.data.data.length > 0) {
            const list = res.data.data;
            let hasNew = false;
            // 倒序入库
            for (let i = list.length - 1; i >= 0; i--) {
                const item = list[i];
                const issue = item.expect;
                const [rows] = await db.query('SELECT id FROM lottery_results WHERE issue = ?', [issue]);
                if (rows.length > 0) continue;

                const nums = item.openCode.split(',').map(Number);
                const flat = nums.slice(0, 6);
                const spec = nums[6];
                // API 生肖
                let sx = item.zodiac.split(',')[6].trim();
                
                await db.execute('INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, open_date) VALUES (?,?,?,?,NOW())', 
                    [issue, JSON.stringify(flat), spec, sx]);
                
                console.log(`[Fetch] New Issue: ${issue}`);
                hasNew = true;
                
                // 触发预测 (每次新数据都重算)
                const [history] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
                const pred = generatePrediction(history);
                const jsonPred = JSON.stringify(pred);
                await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, issue]);

                // 推送
                if (process.env.CHANNEL_ID) {
                    const msg = renderPreview(pred);
                    await bot.telegram.sendMessage(process.env.CHANNEL_ID, msg, { parse_mode: 'HTML' });
                }
            }
            if (hasNew) LAST_SUCCESS_DATE = new Date().toDateString();
        }
    } catch (e) { console.error('[Fetch Error]', e.message); }
}

function startBot() {
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const ADMIN_ID = parseInt(process.env.ADMIN_ID);

    // 定时器 (每分钟)
    setInterval(() => {
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();
        // 21:33 - 21:45 自动抓取
        if ((h === 21 || h === 45) && m >= 33 && m <= 45) {
            if (LAST_SUCCESS_DATE !== now.toDateString()) fetchLottery(bot, ADMIN_ID);
        }
    }, 60000);

    bot.hears('🔮 下期预测', async (ctx) => {
        try {
            const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 1');
            if (!rows.length) return ctx.reply('无数据');
            
            let pred = safeParse(rows[0].next_prediction);
            if (!pred) {
                const [history] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
                pred = generatePrediction(history);
                await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [JSON.stringify(pred), rows[0].issue]);
            }
            ctx.reply(renderPreview(pred), { parse_mode: 'HTML' });
        } catch(e) { ctx.reply("系统错误"); }
    });

    bot.hears('🔄 立即抓取', (ctx) => {
        if (ctx.from.id !== ADMIN_ID) return;
        ctx.reply('⏳ 请求中...');
        fetchLottery(bot, ADMIN_ID);
    });
    
    bot.hears('📊 历史走势', async (ctx) => {
        const [rows] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC LIMIT 10');
        let msg = '<b>📉 近期走势</b>\n';
        rows.forEach(r => {
            let nums = [];
            try { nums = JSON.parse(r.numbers); } catch(e) { nums = r.numbers.split(','); }
            const numStr = nums.map(n=>String(n).padStart(2,'0')).join(' ');
            msg += `${r.issue}: ${numStr} + <b>${String(r.special_code).padStart(2,'0')}</b> (${r.shengxiao})\n`;
        });
        ctx.reply(msg, { parse_mode: 'HTML' });
    });

    bot.hears('🗑 删除记录', (ctx) => {
        if (ctx.from.id === ADMIN_ID) {
            userStates[ctx.from.id] = 'WAIT_DEL';
            ctx.reply('输入期号:');
        }
    });

    bot.on('text', async (ctx) => {
        const text = ctx.message.text;
        if (userStates[ctx.from.id] === 'WAIT_DEL' && /^\d{7}$/.test(text)) {
            await db.execute('DELETE FROM lottery_results WHERE issue=?', [text]);
            userStates[ctx.from.id] = null;
            ctx.reply('✅ 删除成功');
        } else {
             // 尝试解析手动录入
             const res = parseLotteryResult(text);
             if (res) {
                 const {issue, flatNumbers, specialCode, shengxiao} = res;
                 const jsonNums = JSON.stringify(flatNumbers);
                 await db.execute(`INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, open_date) VALUES (?,?,?,?,NOW())`, [issue, jsonNums, specialCode, shengxiao]);
                 
                 // 触发重算
                 const [history] = await db.query('SELECT * FROM lottery_results ORDER BY issue DESC');
                 const pred = generatePrediction(history);
                 const jsonPred = JSON.stringify(pred);
                 await db.execute('UPDATE lottery_results SET next_prediction=? WHERE issue=?', [jsonPred, issue]);
                 ctx.reply('✅ 手动录入成功，预测已更新');
             }
        }
    });

    // 增加错误捕获，防止崩
    bot.launch().then(() => console.log('🤖 Bot Started')).catch(e => console.error('Bot Error:', e));
    
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
}

module.exports = startBot;

const { Telegraf } = require('telegraf');
const db = require('./db');
const { parseLotteryResult, generatePrediction } = require('./utils');

function startBot() {
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const ADMIN_ID = parseInt(process.env.ADMIN_ID);
    const CHANNEL_ID = process.env.CHANNEL_ID; 

    // --- 中间件：权限控制 ---
    bot.use(async (ctx, next) => {
        // 1. 频道消息：只处理指定 ID 的频道
        if (ctx.channelPost) {
            // 如果 .env 没配 CHANNEL_ID，建议先打印出来看看 ctx.chat.id
            if (CHANNEL_ID && String(ctx.chat.id) === String(CHANNEL_ID)) {
                return next();
            }
            // 如果没配置强制频道ID，暂时放行所有频道（调试用），建议生产环境加上校验
            return next(); 
        }

        // 2. 私聊/群组：只处理管理员
        if (ctx.from && ctx.from.id === ADMIN_ID) {
            return next();
        }
    });

    bot.start((ctx) => ctx.reply('🤖 管理员好，开奖机器人已就绪。\n请将开奖频道的文字消息转发给我，即可自动入库。'));

    // --- 核心逻辑：监听文本消息 ---
    bot.on(['text', 'channel_post'], async (ctx) => {
        const text = ctx.message?.text || ctx.channelPost?.text;
        if (!text) return;

        // 1. 解析消息
        const result = parseLotteryResult(text);
        
        if (result) {
            const { issue, flatNumbers, specialCode, shengxiao } = result;

            // 2. 获取历史数据用于计算预测
            let prediction = [];
            try {
                // 获取最近 50 期数据
                const [historyRows] = await db.query('SELECT numbers, special_code FROM lottery_results ORDER BY issue DESC LIMIT 50');
                
                // 将当前这期也加入计算队列
                const currentData = { numbers: flatNumbers, special_code: specialCode };
                const allData = [currentData, ...historyRows];
                
                // 生成下期预测
                prediction = generatePrediction(allData);

            } catch (e) {
                console.error("预测计算失败，降级为随机:", e);
                prediction = generatePrediction([]); 
            }

            // 3. 准备入库
            const sql = `
                INSERT INTO lottery_results (issue, numbers, special_code, shengxiao, next_prediction, open_date)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE numbers=?, special_code=?, shengxiao=?, next_prediction=?, open_date=NOW()
            `;
            
            const jsonNumbers = JSON.stringify(flatNumbers);
            const jsonPrediction = JSON.stringify(prediction);

            try {
                // 4. 执行 SQL
                await db.execute(sql, [
                    issue, jsonNumbers, specialCode, shengxiao, jsonPrediction,
                    jsonNumbers, specialCode, shengxiao, jsonPrediction
                ]);
                
                const replyText = `✅ **第 ${issue} 期录入成功**\n\n🐉 特码: ${specialCode} (${shengxiao})\n🔮 下期预测: ${prediction.join(', ')}`;

                // 5. 反馈结果
                if (ctx.chat.type === 'private') {
                    ctx.replyWithMarkdown(replyText);
                } else {
                    console.log(`[Bot] 频道自动录入: 第${issue}期`);
                }

            } catch (err) {
                console.error("数据库错误:", err);
                if (ctx.chat.type === 'private') ctx.reply('❌ 数据库写入错误，请检查日志。');
            }
        } else {
            // 解析失败时，只在私聊提示，避免频道刷屏
            if (ctx.chat.type === 'private') {
                // 简单的防误触：只有看起来像开奖的才提示错误
                if (text.includes('开奖') || text.includes('第')) {
                    ctx.reply('❓ 格式无法识别，请检查复制的内容是否完整。');
                }
            }
        }
    });

    // --- 启动与错误处理 ---
    bot.launch().then(() => {
        console.log('🚀 Telegram Bot 服务已启动');
    }).catch(err => console.error('❌ Bot 启动失败:', err));

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
}

module.exports = startBot;
const express = require('express');
const cors = require('cors');
const { autoSort } = require('./gameLogic');

const app = express();
const PORT = process.env.PORT || 45775;

app.use(cors());
app.use(express.json());

const SUITS = ['♠', '♥', '♣', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    let deck = [];
    for (let s of SUITS) {
        for (let v of VALUES) {
            deck.push({ suit: s, value: v });
        }
    }
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// API: 发牌并自动理牌
app.get('/api/game/deal', (req, res) => {
    let deck = createDeck();
    shuffle(deck);
    
    const playerHand = deck.slice(0, 13);
    const cpuHand = deck.slice(13, 26);

    const playerSorted = autoSort(playerHand);
    const cpuSorted = autoSort(cpuHand);

    res.json({
        success: true,
        player: {
            raw: playerHand,
            sorted: playerSorted
        },
        cpu: {
            // CPU不返回raw，只返回排好的用于比对
            sorted: cpuSorted
        }
    });
});

// API: 比牌逻辑
app.post('/api/game/compare', (req, res) => {
    const { playerSorted, cpuSorted } = req.body;
    
    // 比牌得分逻辑 (简化版)
    // 头、中、尾分别对比，赢一道得1分
    const compareSegment = (p, c) => {
        if (p.type > c.type) return 1;
        if (p.type < c.type) return -1;
        // 如果牌型相同，这里应该比较数值，暂略
        return 0;
    };

    const frontScore = compareSegment(playerSorted.front, cpuSorted.front);
    const middleScore = compareSegment(playerSorted.middle, cpuSorted.middle);
    const backScore = compareSegment(playerSorted.back, cpuSorted.back);

    const totalScore = frontScore + middleScore + backScore;

    res.json({
        success: true,
        results: {
            front: frontScore,
            middle: middleScore,
            back: backScore,
            total: totalScore
        },
        winner: totalScore > 0 ? 'Player' : (totalScore < 0 ? 'CPU' : 'Draw')
    });
});

app.listen(PORT, () => {
    console.log(`🚀 十三水后端已启动: http://localhost:${PORT}`);
});

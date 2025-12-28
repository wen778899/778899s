const CARD_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const TYPES = {
    HIGH_CARD: 1,
    PAIR: 2,
    TWO_PAIR: 3,
    THREE_OF_A_KIND: 4,
    STRAIGHT: 5,
    FLUSH: 6,
    FULL_HOUSE: 7,
    FOUR_OF_A_KIND: 8,
    STRAIGHT_FLUSH: 9
};

function getCardWeight(card) {
    return CARD_VALUES[card.value];
}

// 获取牌型
function getHandType(cards) {
    const counts = {};
    cards.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);
    const countValues = Object.values(counts).sort((a, b) => b - a);
    
    const isFlush = cards.length >= 5 && cards.every(c => c.suit === cards[0].suit);
    
    let isStraight = false;
    if (cards.length >= 5) {
        const sorted = [...new Set(cards.map(getCardWeight))].sort((a, b) => a - b);
        if (sorted.length >= 5) {
            for (let i = 0; i <= sorted.length - 5; i++) {
                if (sorted[i+4] - sorted[i] === 4) isStraight = true;
            }
            // A2345 special case
            if (sorted.includes(14) && sorted.includes(2) && sorted.includes(3) && sorted.includes(4) && sorted.includes(5)) isStraight = true;
        }
    }

    if (isStraight && isFlush) return TYPES.STRAIGHT_FLUSH;
    if (countValues[0] === 4) return TYPES.FOUR_OF_A_KIND;
    if (countValues[0] === 3 && countValues[1] === 2) return TYPES.FULL_HOUSE;
    if (isFlush) return TYPES.FLUSH;
    if (isStraight) return TYPES.STRAIGHT;
    if (countValues[0] === 3) return TYPES.THREE_OF_A_KIND;
    if (countValues[0] === 2 && countValues[1] === 2) return TYPES.TWO_PAIR;
    if (countValues[0] === 2) return TYPES.PAIR;
    return TYPES.HIGH_CARD;
}

// 自动理牌逻辑 (基础演示版：按数值排序并简单分段)
// 真正的十三水算法极其复杂，这里提供一个基础的合法分段
function autoSort(cards) {
    const sorted = [...cards].sort((a, b) => getCardWeight(b) - getCardWeight(a));
    
    // 简单地把13张牌分为 3, 5, 5
    // 实际游戏中需要考虑牌型大小顺序：头道 < 中道 < 尾道
    const back = sorted.slice(0, 5);
    const middle = sorted.slice(5, 10);
    const front = sorted.slice(10, 13);

    return {
        front: { cards: front, type: getHandType(front) },
        middle: { cards: middle, type: getHandType(middle) },
        back: { cards: back, type: getHandType(back) }
    };
}

module.exports = { autoSort, getHandType, TYPES };

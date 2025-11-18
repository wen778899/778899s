// 文件路径: frontend/src/utils/smartSort.js

/**
 * 一个非常基础的智能理牌算法。
 * 真正的算法非常复杂，需要组合分析和评分。
 * 这个版本仅作为功能演示。
 * @param {object[]} allCards - 包含13张牌完整对象的数组
 * @returns {{head: object[], middle: object[], tail: object[]}}
 */
export const simpleSmartSort = (allCards) => {
  // 1. 按牌值从大到小排序
  const sortedCards = [...allCards].sort((a, b) => b.value - a.value);
  
  // 2. 一个非常天真的分配策略：
  //    - 尾道：取最大的5张牌
  //    - 中道：取中间的5张牌
  //    - 头道：取最小的3张牌
  // 这个策略不能保证牌型合法，仅用于演示！
  const tail = sortedCards.slice(0, 5);
  const middle = sortedCards.slice(5, 10);
  const head = sortedCards.slice(10, 13);
  
  // 确保牌墩内也排序，看起来整齐
  const sortRow = (row) => row.sort((a,b) => b.value - a.value);

  return {
    head: sortRow(head),
    middle: sortRow(middle),
    tail: sortRow(tail),
  };
};const SUITS = { H: 'hearts', S: 'spades', D: 'diamonds', C: 'clubs' };
const RANKS = {
  'A': { name: 'ace', value: 14 },
  'K': { name: 'king', value: 13 },
  'Q': { name: 'queen', value: 12 },
  'J': { name: 'jack', value: 11 },
  '10': { name: '10', value: 10 },
  '9': { name: '9', value: 9 },
  '8': { name: '8', value: 8 },
  '7': { name: '7', value: 7 },
  '6': { name: '6', value: 6 },
  '5': { name: '5', value: 5 },
  '4': { name: '4', value: 4 },
  '3': { name: '3', value: 3 },
  '2': { name: '2', value: 2 },
};

// 后端返回的牌ID（如'S10'）到完整牌对象的映射
const cardMap = new Map();

Object.entries(SUITS).forEach(([suitKey, suitName]) => {
  Object.entries(RANKS).forEach(([rankKey, rankInfo]) => {
    const id = `${suitKey}${rankKey}`;
    cardMap.set(id, {
      id,
      suit: suitKey,
      rank: rankKey,
      value: rankInfo.value,
      image: `/cards/${rankInfo.name}_of_${suitName}.svg`,
    });
  });
});

// 添加大小王（如果需要）
// cardMap.set('BJ', { id: 'BJ', suit: 'Joker', rank: 'Black', value: 98, image: '/cards/black_joker.svg' });
// cardMap.set('RJ', { id: 'RJ', suit: 'Joker', rank: 'Red', value: 99, image: '/cards/red_joker.svg' });


/**
 * 将后端返回的牌ID数组转换为包含完整信息的对象数组
 * @param {string[]} cardIds - e.g., ['S10', 'HA', 'C2']
 * @returns {object[]}
 */
export const mapCardIdsToObjects = (cardIds) => {
  return cardIds.map(id => cardMap.get(id)).filter(Boolean);
};
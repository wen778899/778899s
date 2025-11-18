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
};
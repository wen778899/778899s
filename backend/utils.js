function getCardImage(card) {
  if (card.suit === 'joker') {
    return card.rank === 'red' ? 'red_joker.svg' : 'black_joker.svg';
  }

  const rankMap = {
    'A': 'ace',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    'J': 'jack',
    'Q': 'queen',
    'K': 'king'
  };

  const suitMap = {
    'clubs': 'clubs',
    'diamonds': 'diamonds',
    'hearts': 'hearts',
    'spades': 'spades'
  };

  return `${rankMap[card.rank]}_of_${suitMap[card.suit]}.svg`;
}

module.exports = { getCardImage };

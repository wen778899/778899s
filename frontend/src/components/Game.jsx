
import React, { useState, useEffect, useMemo } from 'react';
import { getHandType, compareHands, TYPES } from '../gameLogic'; // 确保路径正确
import * as api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

// 音效和卡片组件可以保持与之前类似，因此在此省略以保持简洁
// ... (Card, HandPlaceholder, playSound, sounds, CARD_TYPE_NAMES) ...

const CARD_TYPE_NAMES = { [TYPES.HIGH_CARD]: '乌龙', [TYPES.PAIR]: '对子', [TYPES.TWO_PAIR]: '两对', [TYPES.THREE_OF_A_KIND]: '三条', [TYPES.STRAIGHT]: '顺子', [TYPES.FLUSH]: '同花', [TYPES.FULL_HOUSE]: '葫芦', [TYPES.FOUR_OF_A_KIND]: '四条', [TYPES.STRAIGHT_FLUSH]: '同花顺' };

const playSound = (src) => {
  try {
    new Audio(src).play();
  } catch (e) {}
};

const sounds = {
  start: '/sounds/start.mp3',
  click: '/sounds/click.mp3',
  confirm: '/sounds/confirm.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
};

const Card = ({ card, onClick, isSelected }) => (
  <motion.div
    layoutId={`card-${card.suit}-${card.value}`}
    onClick={onClick}
    className={`relative w-16 h-24 m-1 cursor-pointer transition-all duration-200 ${isSelected ? 'ring-4 ring-yellow-500 -translate-y-2' : 'hover:-translate-y-1'}`}
  >
    <img src={`/${card.image}`} className="w-full h-full object-contain drop-shadow-md" />
  </motion.div>
);

const HandPlaceholder = ({ onSelect, children, isInvalid, handType }) => (
  <div 
    onClick={onSelect} 
    className={`relative flex justify-center items-center h-32 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${isInvalid ? 'border-red-500 bg-red-500/10' : 'border-dashed border-white/20 hover:border-white/50 hover:bg-white/5'}`}
  >
    {children}
    {handType && <div className="absolute bottom-1 right-2 text-[10px] font-bold text-yellow-500/50 uppercase tracking-widest">{CARD_TYPE_NAMES[handType.type]}</div>}
    {isInvalid && <div className="absolute top-1 right-2 text-xs font-black text-red-500 uppercase">倒水!</div>}
  </div>
);

const ResultModal = ({ result, onGameEnd }) => (
  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
    <motion.div initial={{scale:0.8}} animate={{scale:1}} className="w-full max-w-md bg-gray-900 border border-yellow-500/30 p-10 rounded-3xl text-center shadow-lg">
      <h2 className={`text-6xl font-black mb-4 ${result.winner === 'Player' ? 'text-yellow-400' : 'text-red-500'}`}>{result.winner === 'Player' ? '胜利' : '惜败'}</h2>
      <p className="text-2xl font-bold mb-6">积分变化: <span className={result.results.total > 0 ? 'text-green-400' : 'text-red-400'}>{result.results.total > 0 ? `+${result.results.total}` : result.results.total}</span></p>
      <div className="flex justify-around mb-8 text-xs uppercase text-gray-400">
        <span>头道: {result.results.front > 0 ? '赢' : '输'}</span>
        <span>中道: {result.results.middle > 0 ? '赢' : '输'}</span>
        <span>尾道: {result.results.back > 0 ? '赢' : '输'}</span>
      </div>
      <button onClick={onGameEnd} className="w-full bg-white text-black py-4 font-bold rounded-xl">返回大厅</button>
    </motion.div>
  </motion.div>
);

export const Game = ({ onGameEnd }) => {
  const [gameState, setGameState] = useState('dealing'); // dealing, playing, settled
  const [unassignedCards, setUnassignedCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [front, setFront] = useState([]);
  const [middle, setMiddle] = useState([]);
  const [back, setBack] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // 组件加载时自动开始游戏并发牌
    const startNewGame = async () => {
      setGameState('dealing');
      playSound(sounds.start);
      try {
        const data = await api.dealNewGame();
        if(data.success) {
          setUnassignedCards(data.hand.sort(() => Math.random() - 0.5));
          setFront([]); setMiddle([]); setBack([]);
          setResult(null); setError('');
          setGameState('playing');
        }
      } catch (e) {
        setError(e.message || '连接服务器失败');
        // 可以在此添加一个返回按钮
      }
    };
    startNewGame();
  }, []);

  const frontHand = useMemo(() => getHandType(front), [front]);
  const middleHand = useMemo(() => getHandType(middle), [middle]);
  const backHand = useMemo(() => getHandType(back), [back]);

  const isMiddleInvalid = useMemo(() => middle.length === 5 && compareHands(frontHand, middleHand) > 0, [front, middle, frontHand, middleHand]);
  const isBackInvalid = useMemo(() => back.length === 5 && (compareHands(middleHand, backHand) > 0 || compareHands(frontHand, backHand) > 0), [front, middle, back, frontHand, middleHand, backHand]);

  const canConfirm = useMemo(() => front.length === 3 && middle.length === 5 && back.length === 5 && !isMiddleInvalid && !isBackInvalid, [front, middle, back, isMiddleInvalid, isBackInvalid]);

  const handleCardClick = (card, source) => {
    playSound(sounds.click);
    if (selectedCard && selectedCard.value === card.value && selectedCard.suit === card.suit) {
      setSelectedCard(null);
    } else if (source === 'unassigned') {
      setSelectedCard(card);
    } else {
      if (source === 'front') setFront(f => f.filter(c => c.value !== card.value || c.suit !== card.suit));
      if (source === 'middle') setMiddle(m => m.filter(c => c.value !== card.value || c.suit !== card.suit));
      if (source === 'back') setBack(b => b.filter(c => c.value !== card.value || c.suit !== card.suit));
      setUnassignedCards(u => [...u, card]);
    }
  };

  const handleHandSelect = (handName) => {
    if (!selectedCard) return;
    const target = { front, middle, back }[handName];
    const setTarget = { front: setFront, middle: setMiddle, back: setBack }[handName];
    const limit = handName === 'front' ? 3 : 5;
    if (target.length < limit) {
      setTarget(h => [...h, selectedCard]);
      setUnassignedCards(u => u.filter(c => c.value !== selectedCard.value || c.suit !== selectedCard.suit));
      setSelectedCard(null);
    }
  };

  const handleConfirm = async () => {
    if(!canConfirm) return;
    playSound(sounds.confirm);
    setGameState('settled');
    const playerSorted = { front: frontHand, middle: middleHand, back: backHand };
    try {
        const res = await api.compareHands(playerSorted);
        setResult(res);
        if(res.winner === 'Player') playSound(sounds.win);
        else playSound(sounds.lose);
    } catch(e) {
      setError(e.message || '提交失败');
      setGameState('playing');
    }
  };

  if (gameState === 'dealing') {
    return <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white text-2xl">正在发牌...</div>;
  }
  
  if (error) {
      return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white"> <p className='text-red-500 mb-4'>{error}</p> <button onClick={onGameEnd} className='bg-yellow-500 text-black px-4 py-2 rounded'>返回大厅</button> </div>
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6">
      <AnimatePresence>{result && <ResultModal result={result} onGameEnd={onGameEnd} />}</AnimatePresence>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-black tracking-widest uppercase text-gray-500">组合你的牌墩</h2>
          <HandPlaceholder onSelect={() => handleHandSelect('front')} handType={front.length === 3 ? frontHand : null}>{front.map(c => <Card key={`${c.suit}-${c.value}`} card={c} onClick={() => handleCardClick(c, 'front')} />)}</HandPlaceholder>
          <HandPlaceholder onSelect={() => handleHandSelect('middle')} isInvalid={isMiddleInvalid} handType={middle.length === 5 ? middleHand : null}>{middle.map(c => <Card key={`${c.suit}-${c.value}`} card={c} onClick={() => handleCardClick(c, 'middle')} />)}</HandPlaceholder>
          <HandPlaceholder onSelect={() => handleHandSelect('back')} isInvalid={isBackInvalid} handType={back.length === 5 ? backHand : null}>{back.map(c => <Card key={`${c.suit}-${c.value}`} card={c} onClick={() => handleCardClick(c, 'back')} />)}</HandPlaceholder>
        </div>
        <div className="space-y-6">
          <h2 className="text-lg font-black tracking-widest uppercase text-gray-500">你的手牌 ({unassignedCards.length})</h2>
          <div className="bg-black/20 p-4 rounded-2xl min-h-[300px]"><div className="flex flex-wrap justify-center"><AnimatePresence>{unassignedCards.map(c => <Card key={`${c.suit}-${c.value}`} card={c} onClick={() => handleCardClick(c, 'unassigned')} isSelected={selectedCard && selectedCard.value === c.value && selectedCard.suit === c.suit} />)}</AnimatePresence></div></div>
          <button onClick={handleConfirm} disabled={!canConfirm} className="w-full py-5 rounded-2xl text-xl font-black transition-all duration-300 disabled:bg-gray-700 disabled:text-gray-500 bg-yellow-500 text-black hover:bg-yellow-400">确认摆牌</button>
        </div>
      </div>
    </div>
  );
};

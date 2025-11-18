// 文件路径: frontend/src/pages/GameTable.jsx
import { useState, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import useGameStore from '../store/gameStore';
import CardRow from '../components/CardRow';
import Card from '../components/Card';
import { simpleSmartSort } from '../utils/smartSort';
import { submitHand } from '../services/api';
import { useNavigate } from 'react-router-dom';


const GameTable = () => {
  const navigate = useNavigate();
  const { gameId, cards, setCards, clearGame } = useGameStore();
  const [activeCard, setActiveCard] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    // 如果刷新页面或直接访问URL，gameStore可能为空，需要返回首页
    if (!gameId) {
      navigate('/');
    }
    return () => {
      // 离开页面时清理游戏状态
      clearGame();
    }
  }, [gameId, navigate, clearGame]);

  const findContainer = (id) => {
    if (id in cards) return id;
    return Object.keys(cards).find(key => cards[key].some(item => item.id === id));
  };
  
  const handleDragStart = (event) => {
    const { active } = event;
    const card = Object.values(cards).flat().find(c => c.id === active.id);
    setActiveCard(card);
  };
  
  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;
  
    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);
  
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }
    
    setCards((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex(item => item.id === active.id);
      const overIndex = overItems.findIndex(item => item.id === over.id);

      let newItems = { ...prev };
      
      const [movedItem] = newItems[activeContainer].splice(activeIndex, 1);
      newItems[overContainer].splice(overIndex, 0, movedItem);

      return newItems;
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) {
      setActiveCard(null);
      return;
    };
    
    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);

    if (activeContainer === overContainer) {
      setCards((prev) => {
        const activeItems = prev[activeContainer];
        const activeIndex = activeItems.findIndex(item => item.id === active.id);
        const overIndex = activeItems.findIndex(item => item.id === over.id);
        
        if(activeIndex !== overIndex) {
          return {
            ...prev,
            [activeContainer]: arrayMove(activeItems, activeIndex, overIndex)
          };
        }
        return prev;
      });
    }
    setActiveCard(null);
  };
  
  const handleSmartSort = () => {
    const allCards = Object.values(cards).flat();
    const sortedHand = simpleSmartSort(allCards);
    setCards(sortedHand);
  };
  
  const handleSubmit = async () => {
    // 简单校验
    if (cards.head.length !== 3 || cards.middle.length !== 5 || cards.tail.length !== 5) {
      alert("请确保头道3张，中道5张，尾道5张！");
      return;
    }
    
    // 将牌对象转换回ID字符串数组
    const handToSubmit = {
      head: cards.head.map(c => c.id),
      middle: cards.middle.map(c => c.id),
      tail: cards.tail.map(c => c.id),
    };
    
    setIsSubmitted(true);
    try {
      const response = await submitHand(gameId, handToSubmit);
      alert(response.data.message);
      // 这里可以开始轮询游戏状态
    } catch(err) {
      alert(err.response?.data?.error || "提交失败");
      setIsSubmitted(false);
    }
  };


  return (
    <DndContext 
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCorners}
    >
      <div className="game-table">
        <div className="game-area">
          <CardRow id="tail" title="尾道" cards={cards.tail} />
          <CardRow id="middle" title="中道" cards={cards.middle} />
          <CardRow id="head" title="头道" cards={cards.head} />
        </div>
        <div className="action-bar">
          <button onClick={handleSmartSort} disabled={isSubmitted}>智能理牌</button>
          <button onClick={handleSubmit} disabled={isSubmitted}>提交牌型</button>
        </div>
      </div>
      <DragOverlay>
        {activeCard ? <Card card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default GameTable;
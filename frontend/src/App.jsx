import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CARD_TYPE_NAMES = {
  1: '乌龙', 2: '对子', 3: '两对', 4: '三条', 5: '顺子',
  6: '同花', 7: '葫芦', 8: '四条', 9: '同花顺'
};

const Card = ({ card, size = "normal" }) => {
  if (!card) return null;
  const isRed = ['♥', '♦'].includes(card.suit);
  const sizeClasses = size === "small" ? "w-10 h-14 text-sm" : "w-14 h-20 text-lg";
  
  return (
    <div className={`bg-white border rounded shadow-md flex flex-col items-center justify-center m-1 ${sizeClasses} ${isRed ? 'text-red-600' : 'text-black'}`}>
      <span className="leading-none">{card.suit}</span>
      <span className="font-bold leading-none">{card.value}</span>
    </div>
  );
};

const HandSegment = ({ title, data }) => (
  <div className="bg-green-700/50 p-3 rounded-lg border border-green-600 mb-4">
    <div className="flex justify-between items-center mb-2">
      <span className="text-yellow-400 font-bold">{title}</span>
      <span className="bg-yellow-600 text-xs px-2 py-0.5 rounded text-white">
        {CARD_TYPE_NAMES[data.type]}
      </span>
    </div>
    <div className="flex flex-wrap justify-center">
      {data.cards.map((c, i) => <Card key={i} card={c} size="small" />)}
    </div>
  </div>
);

const App = () => {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // 请根据实际部署地址修改
  const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:45775/api' 
    : 'https://your-serv00-api.com/api'; 

  const startNewGame = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.get(`${API_BASE}/game/deal`);
      if (res.data.success) {
        setGameState(res.data);
      }
    } catch (err) {
      alert("无法连接到服务器，请检查后端。");
    } finally {
      setLoading(false);
    }
  };

  const compareResult = async () => {
    if (!gameState) return;
    try {
      const res = await axios.post(`${API_BASE}/game/compare`, {
        playerSorted: gameState.player.sorted,
        cpuSorted: gameState.cpu.sorted
      });
      setResult(res.data);
    } catch (err) {
      alert("比牌请求失败");
    }
  };

  return (
    <div className="min-h-screen bg-emerald-900 text-white font-sans pb-10">
      <header className="bg-black/20 p-4 text-center border-b border-white/10">
        <h1 className="text-3xl font-black tracking-tighter text-yellow-500">十三水 · 尊享版</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        {!gameState ? (
          <div className="text-center py-20">
             <div className="mb-8 text-6xl">🎴</div>
             <button 
               onClick={startNewGame}
               className="bg-yellow-500 hover:bg-yellow-400 text-emerald-900 font-black py-4 px-12 rounded-full text-xl shadow-2xl transition-all active:scale-95"
             >
               立即开局
             </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-black/30 p-4 rounded-xl">
               <button onClick={startNewGame} className="text-sm bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20">重新发牌</button>
               <h2 className="text-xl font-bold">我的手牌</h2>
               <button 
                onClick={compareResult}
                disabled={!!result}
                className={`text-sm px-4 py-2 rounded-lg font-bold ${result ? 'bg-gray-500' : 'bg-orange-500 hover:bg-orange-400'}`}
               >
                 {result ? '已比牌' : '开始比牌'}
               </button>
            </div>

            {/* 理牌展示 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <HandSegment title="头道 (3张)" data={gameState.player.sorted.front} />
               <HandSegment title="中道 (5张)" data={gameState.player.sorted.middle} />
               <HandSegment title="尾道 (5张)" data={gameState.player.sorted.back} />
            </div>

            {/* 比牌结果 */}
            {result && (
              <div className="animate-bounce-in bg-yellow-500 text-emerald-900 p-6 rounded-2xl shadow-2xl border-4 border-yellow-300">
                <h3 className="text-2xl font-black text-center mb-4 italic">
                   {result.winner === 'Player' ? '🎉 你赢了！' : (result.winner === 'CPU' ? '💀 输了...' : '🤝 平局')}
                </h3>
                <div className="grid grid-cols-3 text-center font-bold border-t border-emerald-900/20 pt-4">
                  <div>头道: {result.results.front > 0 ? '+1' : (result.results.front < 0 ? '-1' : '0')}</div>
                  <div>中道: {result.results.middle > 0 ? '+1' : (result.results.middle < 0 ? '-1' : '0')}</div>
                  <div>尾道: {result.results.back > 0 ? '+1' : (result.results.back < 0 ? '-1' : '0')}</div>
                </div>
              </div>
            )}
            
            <div className="mt-10 opacity-50 text-xs text-center leading-loose">
              <p>游戏逻辑已完善：包含自动洗牌、发牌、基础牌型识别及自动理牌</p>
              <p>部署在 Serv00 (Node.js) & Cloudflare Pages (React)</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

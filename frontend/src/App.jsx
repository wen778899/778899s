import React, { useEffect, useState } from 'react';
import Ball from './components/Ball';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandHistory, setExpandHistory] = useState(false);

  const fetchData = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL}?action=get_data&t=${Date.now()}`;
      const res = await fetch(apiUrl);
      const json = await res.json();
      if (json.status === 'success') setData(json.data);
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-400 bg-gray-50">正在分析数据模型...</div>;
  if (!data || !data.history || data.history.length === 0) return <div className="p-10 text-center text-gray-500">暂无数据</div>;

  const latestDraw = data.history[0];
  const fullHistoryList = data.history.slice(1);
  const displayList = expandHistory ? fullHistoryList : fullHistoryList.slice(0, 10);
  const remainingCount = fullHistoryList.length - 10;

  // --- 预测数据解析 ---
  const pred = data.prediction;
  const sixXiao = pred.six_xiao || [];
  const threeXiao = pred.three_xiao || sixXiao.slice(0, 3);
  
  let primaryWave = 'red';
  let secondaryWave = 'blue';
  
  if (pred.color_wave && typeof pred.color_wave === 'object') {
    primaryWave = pred.color_wave.primary;
    secondaryWave = pred.color_wave.secondary;
  }

  const waveStyles = {
    red: 'bg-red-600 border-red-500 text-white',
    blue: 'bg-blue-600 border-blue-500 text-white',
    green: 'bg-emerald-600 border-emerald-500 text-white'
  };
  const waveTextStyles = {
    red: 'text-red-500', blue: 'text-blue-500', green: 'text-emerald-500'
  };
  const waveNames = { red: '红', blue: '蓝', green: '绿' };

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-10">
      
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xl">🤖</span>
            <h1 className="text-lg font-bold text-gray-800">AI 智能分析</h1>
          </div>
          <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
            第 {latestDraw.issue} 期已开
          </div>
        </div>
      </header>

      {/* === 预测横幅 === */}
      <div className="bg-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="max-w-2xl mx-auto px-4 py-5 relative z-10">
          
          <div className="flex justify-between items-center mb-4">
             <div>
               <div className="text-[10px] text-indigo-300 uppercase tracking-widest">Next Prediction</div>
               <div className="text-2xl font-bold text-white">第 {data.next_issue} 期</div>
             </div>
             <div className="text-right">
                <div className="text-[10px] text-gray-400">算法模型</div>
                <div className="text-xs bg-indigo-600 px-2 py-0.5 rounded text-white">{pred.strategy_used || 'AI回测'}</div>
             </div>
          </div>

          {/* 三肖区 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
               <span className="text-xs font-bold text-yellow-400">🔥 核心三肖</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {threeXiao.map((z, i) => (
                <div key={i} className="h-10 flex items-center justify-center bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-lg text-lg font-bold text-white shadow-lg border border-yellow-500/50">
                  {z}
                </div>
              ))}
            </div>
          </div>

          {/* 波色区 (新设计) */}
          <div className="flex gap-3 mb-4">
             {/* 左侧：推荐范围 */}
             <div className="flex-1 bg-slate-800/60 rounded-lg p-2 border border-slate-700">
                <div className="text-[10px] text-gray-400 mb-1">推荐波色</div>
                <div className="flex items-center gap-2 font-bold text-sm">
                   <span className={waveTextStyles[primaryWave]}>{waveNames[primaryWave]}波</span>
                   <span className="text-gray-600">/</span>
                   <span className={waveTextStyles[secondaryWave]}>{waveNames[secondaryWave]}波</span>
                </div>
             </div>
             {/* 右侧：主攻 */}
             <div className={`flex-1 rounded-lg p-2 border flex flex-col items-center justify-center relative overflow-hidden ${waveStyles[primaryWave]}`}>
                <div className="absolute top-0 left-0 bg-white/20 text-[8px] px-1 rounded-br">主攻</div>
                <div className="font-bold text-lg leading-none">{waveNames[primaryWave]}波</div>
             </div>
          </div>

          {/* 六肖防守 */}
          <div className="flex items-center gap-2 opacity-60">
             <span className="text-xs">防守:</span>
             <div className="flex gap-1">
                {sixXiao.slice(3).map((z, i) => (
                   <span key={i} className="text-xs font-mono bg-white/10 px-1.5 rounded">{z}</span>
                ))}
             </div>
          </div>

        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-4 pt-4 px-3">
        {/* 最新开奖 (保持不变) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="text-center mb-4 relative">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
             <span className="relative bg-white px-4 text-xs text-gray-400 font-bold">LATEST RESULT</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex justify-center flex-wrap gap-2 mb-4 w-full">
              {latestDraw.normals.map((ball, idx) => (
                <Ball key={idx} num={ball.num} color={ball.color} zodiac={ball.zodiac} size="lg" />
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 w-full mb-2">
               <div className="h-px bg-gray-200 w-12"></div>
               <span className="text-lg font-light text-gray-300">+</span>
               <div className="h-px bg-gray-200 w-12"></div>
            </div>
            <Ball num={latestDraw.spec.num} color={latestDraw.spec.color} zodiac={latestDraw.spec.zodiac} size="xl" isSpec={true} />
          </div>
        </div>

        {/* 历史记录 (保持不变) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-xs text-gray-500 font-bold uppercase">History</span>
          </div>
          <div className="divide-y divide-gray-100">
            {displayList.map((item) => (
              <div key={item.id} className="p-3 flex flex-col gap-2 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-center">
                   <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-gray-700">No.{item.issue}</span>
                      <div className={`w-2 h-2 rounded-full ${item.spec.color === 'red' ? 'bg-red-500' : item.spec.color === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                   </div>
                   <span className="text-[10px] text-gray-400">{item.created_at?.substring(5, 16)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 overflow-x-auto no-scrollbar w-full mr-2 pb-1">
                    {item.normals.map((ball, idx) => (
                      <Ball key={idx} num={ball.num} color={ball.color} zodiac={ball.zodiac} size="sm" />
                    ))}
                  </div>
                  <div className="w-px h-6 bg-gray-200 mx-1 flex-shrink-0"></div>
                  <div className="flex-shrink-0">
                    <Ball num={item.spec.num} color={item.spec.color} zodiac={item.spec.zodiac} size="md" isSpec={true} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!expandHistory && remainingCount > 0 && (
            <button onClick={() => setExpandHistory(true)} className="w-full py-3 text-sm text-indigo-600 font-bold bg-gray-50 border-t border-gray-100">⬇️ 展开剩余 {remainingCount} 期</button>
          )}
          {expandHistory && (
             <button onClick={() => setExpandHistory(false)} className="w-full py-3 text-sm text-gray-500 bg-gray-50 border-t border-gray-100">⬆️ 收起</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
import React, { useEffect, useState } from 'react';
import Ball from './components/Ball';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 控制历史记录展开
  const [expandHistory, setExpandHistory] = useState(false);

  const fetchData = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL}?action=get_data&t=${Date.now()}`;
      const res = await fetch(apiUrl);
      const json = await res.json();
      if (json.status === 'success') {
        setData(json.data);
      }
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-400 bg-gray-50">数据分析中...</div>;
  if (!data || !data.history || data.history.length === 0) return <div className="p-10 text-center text-gray-500">暂无数据</div>;

  const latestDraw = data.history[0];
  const fullHistoryList = data.history.slice(1);
  const displayList = expandHistory ? fullHistoryList : fullHistoryList.slice(0, 10);
  const remainingCount = fullHistoryList.length - 10;

  // --- 解析新版预测数据 ---
  const pred = data.prediction;
  
  // 兼容性处理：防止后端还没生成新结构时前端报错
  const sixXiao = pred.six_xiao || [];
  const threeXiao = pred.three_xiao || sixXiao.slice(0, 3); // 如果没有三肖字段，默认取六肖前三个
  
  // 波色处理 (支持旧版字符串和新版对象)
  let primaryWave = 'red';
  let secondaryWave = null;
  
  if (typeof pred.color_wave === 'string') {
    primaryWave = pred.color_wave;
  } else if (pred.color_wave) {
    primaryWave = pred.color_wave.primary;
    secondaryWave = pred.color_wave.secondary;
  }

  // 波色样式映射
  const waveStyles = {
    red: 'bg-red-600 border-red-400 text-white',
    blue: 'bg-blue-600 border-blue-400 text-white',
    green: 'bg-emerald-600 border-emerald-400 text-white'
  };
  const waveNames = { red: '红', blue: '蓝', green: '绿' };

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-10">
      
      {/* === 顶部 Header === */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xl">📊</span>
            <h1 className="text-lg font-bold text-gray-800 tracking-tight">智能分析系统</h1>
          </div>
          <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
            第 {latestDraw.issue} 期已开
          </div>
        </div>
      </header>

      {/* === 核心预测横幅 (重大升级) === */}
      <div className="bg-slate-900 text-white shadow-xl relative overflow-hidden pb-1">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
        
        <div className="max-w-2xl mx-auto px-4 py-4 relative z-10">
          <div className="flex justify-between items-start mb-3">
             <div className="flex flex-col">
               <span className="text-[10px] text-indigo-300 uppercase tracking-wider">Prediction</span>
               <span className="text-lg font-bold text-white">第 {data.next_issue} 期 预测</span>
             </div>
             {/* 波色推荐区 */}
             <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                   <span className="text-[10px] text-gray-400">主攻</span>
                   <span className={`px-3 py-1 text-sm font-bold rounded border shadow-sm ${waveStyles[primaryWave]}`}>
                      {waveNames[primaryWave]}波
                   </span>
                </div>
                {secondaryWave && (
                  <div className="flex flex-col items-end opacity-80 scale-90">
                     <span className="text-[10px] text-gray-500">防守</span>
                     <span className={`px-2 py-1 text-xs font-bold rounded border ${waveStyles[secondaryWave]}`}>
                        {waveNames[secondaryWave]}
                     </span>
                  </div>
                )}
             </div>
          </div>

          {/* 精选三肖 (高亮展示) */}
          <div className="mb-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
               <span className="text-xs text-yellow-500 font-bold">🔥 核心三肖</span>
               <span className="text-[10px] text-gray-500">概率最高</span>
            </div>
            <div className="flex gap-3">
              {threeXiao.map((z, i) => (
                <div key={i} className="flex-1 h-9 flex items-center justify-center bg-gradient-to-b from-yellow-600 to-yellow-700 rounded text-sm font-bold text-white shadow border border-yellow-500">
                  {z}
                </div>
              ))}
            </div>
          </div>

          {/* 基础六肖 (小字展示) */}
          <div className="flex items-center gap-2 opacity-80">
             <span className="text-xs text-indigo-300">防守六肖:</span>
             <div className="flex gap-2">
                {sixXiao.map((z, i) => (
                   <span key={i} className="text-xs font-mono bg-slate-800 px-1.5 py-0.5 rounded text-gray-300 border border-slate-700">
                     {z}
                   </span>
                ))}
             </div>
          </div>

        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-4 pt-4 px-3">
        
        {/* === 最新开奖结果 === */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="text-center mb-4 relative">
             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
             <span className="relative bg-white px-4 text-xs text-gray-400 font-bold">LATEST RESULT</span>
          </div>
          
          <div className="flex flex-col items-center">
            {/* 平码 */}
            <div className="flex justify-center flex-wrap gap-2 mb-4 w-full">
              {latestDraw.normals.map((ball, idx) => (
                <Ball key={idx} num={ball.num} color={ball.color} zodiac={ball.zodiac} size="lg" />
              ))}
            </div>

            {/* 特码线 */}
            <div className="flex items-center justify-center gap-3 w-full mb-2">
               <div className="h-px bg-gray-200 w-12"></div>
               <span className="text-lg font-light text-gray-300">+</span>
               <div className="h-px bg-gray-200 w-12"></div>
            </div>

            {/* 特码 */}
            <Ball num={latestDraw.spec.num} color={latestDraw.spec.color} zodiac={latestDraw.spec.zodiac} size="xl" isSpec={true} />
          </div>
        </div>

        {/* === 历史记录 === */}
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
                      {/* 波色点 */}
                      <div className={`w-2 h-2 rounded-full ${waveStyles[item.spec.color].split(' ')[0]}`}></div>
                   </div>
                   <span className="text-[10px] text-gray-400">{item.created_at?.substring(5, 16)}</span>
                </div>

                <div className="flex items-center justify-between">
                  {/* 平码滚动条 */}
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
            <button onClick={() => setExpandHistory(true)} className="w-full py-3 text-sm text-indigo-600 font-bold bg-gray-50 border-t border-gray-100">
              ⬇️ 展开剩余 {remainingCount} 期
            </button>
          )}
          {expandHistory && (
             <button onClick={() => setExpandHistory(false)} className="w-full py-3 text-sm text-gray-500 bg-gray-50 border-t border-gray-100">
              ⬆️ 收起
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
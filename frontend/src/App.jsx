import React, { useEffect, useState } from 'react';
import Ball from './components/Ball';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      // 加上 timestamp 防止缓存
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-100 text-slate-500">
      <div className="animate-spin text-4xl mb-4">⏳</div>
      <p>正在加载数据...</p>
    </div>
  );

  if (!data || data.history.length === 0) return <div className="p-10 text-center">暂无数据，请先在 TG 录入。</div>;

  // 拆分数据：最新一期 vs 历史记录
  const latestDraw = data.history[0];
  const historyList = data.history.slice(1);

  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans">
      
      {/* === 顶部导航 === */}
      <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-200">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎰</span>
            <h1 className="text-lg font-bold text-slate-800">澳门六合彩</h1>
          </div>
          <button 
            onClick={fetchData} 
            disabled={refreshing}
            className={`text-sm px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium active:scale-95 transition-all ${refreshing ? 'opacity-50' : ''}`}
          >
            {refreshing ? '刷新中...' : '刷新'}
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto space-y-4 pt-4 px-3">
        
        {/* === 最新一期 (Hero Section) === */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden border border-indigo-50">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex justify-between items-center">
            <div>
              <p className="text-xs opacity-80 mb-1">最新开奖结果</p>
              <h2 className="text-2xl font-bold tracking-wider">第 {latestDraw.issue} 期</h2>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-80">下次开奖</p>
              <p className="font-mono font-bold text-yellow-300">第 {data.next_issue} 期</p>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-col items-center">
              {/* 平码区 */}
              <div className="flex flex-wrap justify-center gap-3 mb-6">
                {latestDraw.normals.map((ball, idx) => (
                  <Ball key={idx} num={ball.num} color={ball.color} zodiac={ball.zodiac} size="lg" />
                ))}
              </div>

              {/* 分隔线与特码 */}
              <div className="relative w-full flex justify-center items-center mb-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dashed border-gray-200"></div>
                </div>
                <span className="relative bg-white px-4 text-gray-400 text-sm">特码</span>
              </div>

              {/* 特码大球 */}
              <div className="bg-yellow-50 p-4 rounded-full border border-yellow-100 shadow-inner">
                <Ball num={latestDraw.spec.num} color={latestDraw.spec.color} zodiac={latestDraw.spec.zodiac} size="xl" isSpec={true} />
              </div>
            </div>
          </div>
        </section>

        {/* === 智能预测卡片 === */}
        <section className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 relative overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute -right-4 -top-4 text-9xl opacity-5 select-none pointer-events-none">🔮</div>
          
          <div className="flex items-center gap-2 mb-4 border-l-4 border-indigo-500 pl-3">
            <h3 className="text-lg font-bold text-gray-800">第 {data.next_issue} 期 智能推算</h3>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-bold">AI BETA</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 六肖预测 */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xs text-gray-500 mb-2">本期必中六肖</p>
              <div className="flex flex-wrap gap-2">
                {data.prediction.six_xiao.map((z, i) => (
                  <div key={i} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-700 shadow-sm">
                    {z}
                  </div>
                ))}
              </div>
            </div>

            {/* 波色预测 */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
              <p className="text-xs text-gray-500">主攻波色</p>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-4 h-4 rounded-full 
                  ${data.prediction.color_wave === 'red' ? 'bg-red-500' : 
                    data.prediction.color_wave === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                </div>
                <span className={`text-xl font-bold
                  ${data.prediction.color_wave === 'red' ? 'text-red-600' : 
                    data.prediction.color_wave === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`}>
                   {data.prediction.color_wave === 'red' ? '红波' : 
                    data.prediction.color_wave === 'blue' ? '蓝波' : '绿波'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* === 历史记录列表 === */}
        <section className="pt-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-gray-700 text-lg">往期记录</h3>
            <span className="text-xs text-gray-400">近 50 期</span>
          </div>
          
          <div className="space-y-3 pb-8">
            {historyList.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                
                {/* 期号行 */}
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <span className="font-mono font-bold text-gray-600">No. {item.issue}</span>
                  <span className="text-xs text-gray-400">已开奖</span>
                </div>

                {/* 号码行 */}
                <div className="flex items-center justify-between">
                  {/* 平码 (稍微小一点) */}
                  <div className="flex gap-1 md:gap-2">
                    {item.normals.map((ball, idx) => (
                      <Ball key={idx} num={ball.num} color={ball.color} zodiac={ball.zodiac} size="sm" />
                    ))}
                  </div>

                  {/* 符号 + */}
                  <div className="text-gray-200 text-lg font-light px-1">+</div>

                  {/* 特码 (稍微大一点) */}
                  <div className="bg-yellow-50 p-1.5 rounded-lg border border-yellow-100">
                    <Ball num={item.spec.num} color={item.spec.color} zodiac={item.spec.zodiac} size="md" isSpec={true} />
                  </div>
                </div>

              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

export default App;
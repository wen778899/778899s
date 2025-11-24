import React, { useEffect, useState } from 'react';
import Ball from './components/Ball';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 加上时间戳防止缓存
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

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-400">加载数据中...</div>;
  if (!data) return <div className="p-10 text-center">暂无数据</div>;

  const latestDraw = data.history[0];
  const historyList = data.history.slice(1);

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-10">
      
      {/* === 顶部 Header === */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-black tracking-tighter text-gray-800">
            MACAO<span className="text-red-600">6</span>
          </h1>
          <div className="text-xs text-gray-400 font-mono">
            第 {latestDraw.issue} 期结果
          </div>
        </div>
      </header>

      {/* === 预测横幅 (Banner) === */}
      {/* 按照要求，这是一个横跨屏幕的横幅，不是卡片 */}
      <div className="bg-indigo-900 text-white shadow-lg relative overflow-hidden">
        <div className="max-w-2xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* 左侧：标题 */}
          <div className="flex items-center gap-2">
            <span className="bg-indigo-700 text-indigo-200 text-xs px-2 py-1 rounded font-mono">
              NEXT: {data.next_issue}
            </span>
            <span className="font-bold text-sm tracking-wide">智能算法预测</span>
          </div>

          {/* 右侧：预测内容 */}
          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
            {/* 六肖 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-indigo-300 mr-1">六肖:</span>
              {data.prediction.six_xiao.map((z, i) => (
                <span key={i} className="w-6 h-6 flex items-center justify-center bg-indigo-800 border border-indigo-600 rounded text-xs font-bold text-yellow-400">
                  {z}
                </span>
              ))}
            </div>

            {/* 波色 */}
            <div className="flex items-center gap-1">
               <span className="text-xs text-indigo-300">波色:</span>
               <span className={`px-2 py-0.5 text-xs font-bold rounded border
                 ${data.prediction.color_wave === 'red' ? 'bg-red-900 border-red-500 text-red-300' : 
                   data.prediction.color_wave === 'blue' ? 'bg-blue-900 border-blue-500 text-blue-300' : 
                   'bg-emerald-900 border-emerald-500 text-emerald-300'}`}>
                 {data.prediction.color_wave === 'red' ? '红' : 
                  data.prediction.color_wave === 'blue' ? '蓝' : '绿'}
               </span>
            </div>
          </div>

        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        
        {/* === 最新一期 (Hero) === */}
        {/* 去除卡片阴影，直接展示背景 */}
        <div className="bg-white border-b border-gray-200 p-6 mb-2">
          <div className="flex flex-col items-center">
            
            <div className="mb-6 w-full">
              <div className="flex justify-center flex-wrap gap-3">
                {latestDraw.normals.map((ball, idx) => (
                  <Ball key={idx} num={ball.num} color={ball.color} zodiac={ball.zodiac} size="lg" />
                ))}
              </div>
            </div>

            {/* 特码分割线 */}
            <div className="w-full flex items-center gap-4 mb-4">
               <div className="h-px bg-gray-200 flex-1"></div>
               <span className="text-xs text-gray-400 font-bold">特码 SPEC</span>
               <div className="h-px bg-gray-200 flex-1"></div>
            </div>

            <div className="flex items-center gap-4">
               {/* 这里的特码使用最大的方框 */}
               <Ball num={latestDraw.spec.num} color={latestDraw.spec.color} zodiac={latestDraw.spec.zodiac} size="xl" isSpec={true} />
            </div>

          </div>
        </div>

        {/* === 历史记录列表 === */}
        <div className="bg-white">
          <div className="px-4 py-2 bg-gray-100 border-y border-gray-200 text-xs text-gray-500 font-bold uppercase tracking-wider">
            History Records
          </div>
          
          <div className="divide-y divide-gray-100">
            {historyList.map((item) => (
              <div key={item.id} className="p-4 flex flex-col gap-3 hover:bg-gray-50 transition-colors">
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-mono font-bold text-gray-800">
                    第 {item.issue} 期
                  </span>
                  <span className="text-xs text-gray-400">{item.created_at || '已完结'}</span>
                </div>

                <div className="flex items-center justify-between">
                  {/* 平码区 */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {item.normals.map((ball, idx) => (
                      <Ball key={idx} num={ball.num} color={ball.color} zodiac={ball.zodiac} size="sm" />
                    ))}
                  </div>

                  {/* 竖线分隔 */}
                  <div className="w-px h-8 bg-gray-200 mx-2"></div>

                  {/* 特码区 */}
                  <div className="flex-shrink-0">
                    <Ball num={item.spec.num} color={item.spec.color} zodiac={item.spec.zodiac} size="md" isSpec={true} />
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
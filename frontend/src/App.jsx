import React, { useEffect, useState } from 'react';
import Ball from './components/Ball';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const res = await fetch(`${apiUrl}?action=get_data`);
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
    fetchData();
  }, []);

  if (loading) return <div className="flex justify-center items-center h-screen">加载中...</div>;
  if (!data) return <div className="text-center mt-10">暂无数据或连接失败</div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10">
      {/* 顶部标题 */}
      <header className="bg-indigo-600 text-white p-4 shadow-lg">
        <h1 className="text-xl font-bold text-center">📊 开奖与预测系统</h1>
        <p className="text-center text-xs opacity-80 mt-1">仅供技术研究与娱乐，不构成投资建议</p>
      </header>

      {/* 预测卡片 */}
      <div className="m-4 bg-white rounded-xl shadow-md p-5 border border-indigo-100">
        <div className="flex justify-between items-center border-b pb-2 mb-3">
          <h2 className="text-lg font-bold text-indigo-800">🔮 第 {data.next_issue} 期 智能推算</h2>
          <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded">算法生成</span>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">推荐六肖：</p>
          <div className="flex justify-between">
            {data.prediction.six_xiao.map((z, i) => (
              <div key={i} className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-700 font-bold shadow-sm border border-orange-200">
                {z}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
           <p className="text-sm text-gray-500">推荐波色：</p>
           <div className={`px-4 py-1 rounded-full text-white text-sm font-bold shadow 
             ${data.prediction.color_wave === 'red' ? 'bg-red-500' : 
               data.prediction.color_wave === 'blue' ? 'bg-blue-500' : 'bg-green-500'}`}>
             {data.prediction.color_wave === 'red' ? '红波' : 
              data.prediction.color_wave === 'blue' ? '蓝波' : '绿波'}
           </div>
        </div>
      </div>

      {/* 历史列表 */}
      <div className="px-4">
        <h3 className="text-md font-bold text-gray-700 mb-3 pl-1 border-l-4 border-indigo-500">历史开奖走势</h3>
        <div className="space-y-3">
          {data.history.map((item) => (
            <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm">
              <div className="flex justify-between items-end mb-2 border-b border-dashed pb-2">
                <span className="text-sm font-bold text-gray-800">第 {item.issue} 期</span>
                <span className="text-xs text-gray-400">结果公示</span>
              </div>
              
              <div className="flex items-center justify-between">
                {/* 平码区 */}
                <div className="flex gap-1 md:gap-2">
                  {item.normals.map((ball, idx) => (
                    <Ball key={idx} num={ball.num} color={ball.color} zodiac={ball.zodiac} />
                  ))}
                </div>
                
                {/* 分隔符 */}
                <div className="text-gray-300 text-xl font-light mx-1">+</div>
                
                {/* 特码区 */}
                <div className="bg-yellow-50 p-1 rounded-lg border border-yellow-100">
                  <Ball num={item.spec.num} color={item.spec.color} zodiac={item.spec.zodiac} size="lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
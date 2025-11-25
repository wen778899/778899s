import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function HistoryPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // 获取最近 100 期战绩 (数量可以改大)
        const res = await fetch(`${import.meta.env.VITE_API_URL}?action=get_history&t=${Date.now()}`);
        const json = await res.json();
        if (json.status === 'success') setRecords(json.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-10">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors">
            <span>← 返回</span>
          </Link>
          <h1 className="text-base font-bold text-gray-800">预测战绩全览</h1>
          <div className="w-10"></div> {/* 占位用，保持标题居中 */}
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {loading ? (
          <div className="text-center text-gray-400 py-10">加载战绩中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <span className="text-xs text-gray-500 font-bold uppercase">Accuracy Records</span>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{records.length} 期</span>
            </div>
            
            <div className="divide-y divide-gray-100">
              {records.map((item) => (
                <div key={item.issue} className="p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                       <span className="font-mono text-lg font-bold text-gray-800">{item.issue}期</span>
                       <span className="text-xs text-gray-400 border border-gray-200 px-1 rounded">开: {item.result_zodiac}</span>
                    </div>
                    <div className="text-xs text-gray-400">{item.created_at?.substring(5,16)}</div>
                  </div>
                  
                  <div className="flex gap-2 mt-1">
                     {/* 六肖状态 */}
                     <span className={`flex-1 py-1.5 rounded text-center text-xs font-bold border 
                       ${item.is_hit_six == 1 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                       {item.is_hit_six == 1 ? '六肖中' : '六肖错'}
                     </span>
                     {/* 三肖状态 */}
                     <span className={`flex-1 py-1.5 rounded text-center text-xs font-bold border 
                       ${item.is_hit_three == 1 ? 'bg-yellow-50 border-yellow-100 text-yellow-700' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                       {item.is_hit_three == 1 ? '🔥三肖中' : '-'}
                     </span>
                     {/* 波色状态 */}
                     <span className={`flex-1 py-1.5 rounded text-center text-xs font-bold border 
                       ${item.is_hit_wave == 1 ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                       {item.is_hit_wave == 1 ? '波色中' : '-'}
                     </span>
                  </div>
                </div>
              ))}
              
              {records.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                  暂无复盘数据，等待开奖后生成。
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { RefreshCw, Trophy, History, Sparkles, ChevronRight, Calendar } from 'lucide-react';

// --- 辅助工具 ---

// 波色判定逻辑
const getWaveColor = (n) => {
  const red = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46];
  const blue = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48];
  // 剩下的是绿
  if (red.includes(n)) return 'red';
  if (blue.includes(n)) return 'blue';
  return 'green';
};

// --- 组件定义 ---

// 立体球组件
const Ball = ({ num, size = 'md', isSpecial = false, delay = 0 }) => {
  const colorType = getWaveColor(num);
  
  // 颜色映射：背景渐变 + 边框
  const styles = {
    red: 'bg-gradient-to-br from-red-500 to-red-700 border-red-400 text-white',
    blue: 'bg-gradient-to-br from-blue-400 to-blue-700 border-blue-300 text-white',
    green: 'bg-gradient-to-br from-emerald-400 to-emerald-700 border-emerald-300 text-white',
  };

  const sizeClass = size === 'lg' ? 'w-10 h-10 text-lg' : 'w-8 h-8 text-sm';
  
  return (
    <div 
      className={`
        relative flex items-center justify-center rounded-full font-bold shadow-ball border-[1px]
        ${styles[colorType]} ${sizeClass} select-none
        transition-transform duration-300 hover:scale-110
        animate-fade-in
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* 高光效果，增加立体感 */}
      <div className="absolute top-1 left-2 w-2 h-1 bg-white opacity-40 rounded-full blur-[1px]"></div>
      
      {String(num).padStart(2, '0')}
      
      {/* 特码标识 */}
      {isSpecial && (
        <div className="absolute -top-2 -right-1 bg-yellow-400 text-yellow-900 text-[9px] px-1 rounded-sm shadow-sm font-bold border border-white">
          特
        </div>
      )}
    </div>
  );
};

// 骨架屏（加载时显示）
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl p-5 shadow-card animate-pulse mb-4">
    <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
    <div className="flex justify-center gap-2 mb-4">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="w-10 h-10 bg-gray-200 rounded-full"></div>
      ))}
    </div>
    <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
  </div>
);

// --- 主程序 ---

function App() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = 'https://9526.ip-ddns.com/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      // 人为增加 300ms 延迟，让加载动画展示一下，体验更平滑
      await new Promise(r => setTimeout(r, 300));
      const [resLatest, resHistory] = await Promise.all([
        axios.get(`${API_URL}/latest`),
        axios.get(`${API_URL}/history`)
      ]);
      
      if(resLatest.data.success) setLatest(resLatest.data.data);
      if(resHistory.data.success) setHistory(resHistory.data.data);
    } catch (error) {
      console.error("加载失败", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen max-w-[480px] mx-auto bg-[#f8f9fa] shadow-2xl overflow-hidden relative">
      
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Trophy size={18} />
          </div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">港澳六合宝典</h1>
        </div>
        <button 
          onClick={fetchData} 
          className="p-2 bg-gray-50 text-indigo-600 rounded-full hover:bg-indigo-50 transition active:scale-95"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      <main className="p-4 space-y-5">
        
        {/* 1. 最新开奖区域 */}
        {loading ? <SkeletonCard /> : latest ? (
          <div className="bg-white rounded-2xl p-5 shadow-card border border-white relative overflow-hidden group">
            {/* 装饰背景 */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition duration-500"></div>
            
            <div className="flex justify-between items-end mb-4 relative z-10">
              <div>
                <p className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                  <Calendar size={12}/> {dayjs(latest.open_date).format('YYYY年MM月DD日')}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-800 tracking-tighter">第{latest.issue}期</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-md font-medium">已开奖</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">属性</p>
                <p className="font-bold text-gray-700">{latest.shengxiao || '-'}</p>
              </div>
            </div>

            {/* 号码展示区 */}
            <div className="flex flex-wrap justify-between items-center gap-y-2 mb-2 relative z-10">
              <div className="flex gap-1.5 md:gap-2">
                {latest.numbers.map((n, i) => (
                  <Ball key={i} num={n} size="lg" delay={i * 100} />
                ))}
              </div>
              <div className="text-gray-300 pb-1 text-xl font-light">+</div>
              <Ball num={latest.special_code} size="lg" isSpecial delay={700} />
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">下期开奖: 待定</span>
              <span className="text-xs text-indigo-500 font-medium flex items-center cursor-pointer">
                走势分析 <ChevronRight size={12} />
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">暂无数据</div>
        )}

        {/* 2. 智能预测区域 (VIP卡片风格) */}
        {!loading && latest && latest.next_prediction && (
          <div className="rounded-2xl p-1 bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 shadow-lg shadow-amber-100/50">
            <div className="bg-white rounded-xl p-4 relative overflow-hidden">
               {/* 金色光泽动画 */}
               <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 animate-[shimmer_2s_infinite]"></div>
               
               <div className="flex items-center gap-2 mb-3 relative z-10">
                 <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                   <Sparkles size={16} fill="currentColor" />
                 </div>
                 <h3 className="font-bold text-gray-800">
                   第 {parseInt(latest.issue) + 1} 期 <span className="text-amber-500">心水推荐</span>
                 </h3>
                 <span className="ml-auto text-[10px] bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full font-bold">
                   VIP
                 </span>
               </div>

               <div className="flex justify-between gap-1 relative z-10 px-1">
                 {latest.next_prediction.map((n, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-b from-amber-50 to-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shadow-sm text-sm">
                        {String(n).padStart(2, '0')}
                      </div>
                    </div>
                 ))}
               </div>
               <p className="text-center text-[10px] text-gray-400 mt-3 relative z-10">
                 * 大数据AI算法预测，仅供参考，请理性购彩
               </p>
            </div>
          </div>
        )}

        {/* 3. 历史记录 */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-gray-50">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <History size={16} className="text-gray-400" />
            <span className="font-bold text-gray-700 text-sm">历史开奖</span>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((item, index) => (
              <div key={item.issue} className="p-3 hover:bg-gray-50 transition-colors flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-500">第 {item.issue} 期</span>
                  <span className="text-[10px] text-gray-300">{dayjs(item.open_date).format('MM-DD')}</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {item.numbers.map((n, i) => (
                     <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-medium shadow-sm ${
                        getWaveColor(n) === 'red' ? 'bg-red-500' : 
                        getWaveColor(n) === 'blue' ? 'bg-blue-500' : 'bg-green-500'
                     }`}>
                       {String(n).padStart(2, '0')}
                     </div>
                  ))}
                  <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-medium shadow-sm relative ${
                      getWaveColor(item.special_code) === 'red' ? 'bg-red-500' : 
                      getWaveColor(item.special_code) === 'blue' ? 'bg-blue-500' : 'bg-green-500'
                   }`}>
                     {String(item.special_code).padStart(2, '0')}
                     <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full border border-white"></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
      
      {/* 底部版权 */}
      <footer className="text-center py-6 text-gray-300 text-xs">
        <p>© 2024 六合宝典 · 数据仅供娱乐</p>
      </footer>
    </div>
  );
}

export default App;
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { RefreshCw, Trophy, History, Sparkles, ChevronRight, BarChart3 } from 'lucide-react';

// --- 波色逻辑 ---
const getWaveColor = (n) => {
  const red = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46];
  const blue = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48];
  if (red.includes(n)) return 'red';
  if (blue.includes(n)) return 'blue';
  return 'green';
};

// --- 强立体球组件 ---
const Ball = ({ num, size = 'md', isSpecial = false, delay = 0 }) => {
  const colorType = getWaveColor(num);
  
  // 暴力立体配色：使用 CSS 渐变 + 强力内阴影
  const styles = {
    red: 'bg-gradient-to-br from-[#ff7675] to-[#d63031] border-[#ff7675]',
    blue: 'bg-gradient-to-br from-[#74b9ff] to-[#0984e3] border-[#74b9ff]',
    green: 'bg-gradient-to-br from-[#55efc4] to-[#00b894] border-[#55efc4]',
  };

  const sizeClass = size === 'lg' ? 'w-11 h-11 text-xl' : 'w-8 h-8 text-xs';
  
  return (
    <div 
      className={`
        ${sizeClass} ${styles[colorType]}
        relative flex items-center justify-center rounded-full 
        font-black text-white select-none border-[1px]
        opacity-0 animate-pop-up
        shadow-[inset_-3px_-3px_5px_rgba(0,0,0,0.3),inset_2px_2px_5px_rgba(255,255,255,0.6),0_6px_10px_rgba(0,0,0,0.2)]
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* 顶部高光点 (让球看起来像玻璃/塑料材质) */}
      <div className="absolute top-[15%] left-[20%] w-[30%] h-[20%] bg-white opacity-40 rounded-full blur-[1px]"></div>
      
      <span className="drop-shadow-md z-10 font-sans">{String(num).padStart(2, '0')}</span>
      
      {/* 特码角标 */}
      {isSpecial && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-900 text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-sm font-bold border border-white z-20 animate-bounce">
          特
        </div>
      )}
    </div>
  );
};

// --- 主程序 ---

function App() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // ⚠️ 请确保这里的域名是您的后端域名
  const API_URL = 'https://9526.ip-ddns.com/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      // 强制延迟 500ms 展示加载动画
      await new Promise(r => setTimeout(r, 500));
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
    <div className="min-h-screen max-w-[500px] mx-auto bg-gray-100 shadow-2xl relative">
      
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg px-5 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Trophy size={20} fill="currentColor" className="opacity-90"/>
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-800 tracking-tight leading-none">六合宝典</h1>
            <p className="text-[10px] text-gray-400 font-medium tracking-wider">OFFICIAL LOTTERY</p>
          </div>
        </div>
        <button 
          onClick={fetchData} 
          className="w-9 h-9 flex items-center justify-center bg-gray-50 text-indigo-600 rounded-full hover:bg-indigo-50 active:scale-90 transition-all shadow-sm border border-gray-100"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      <main className="p-4 space-y-6 pb-12">
        
        {/* 1. 最新开奖卡片 */}
        {latest ? (
          <div className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group border border-white">
            {/* 背景装饰光 */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -z-0 opacity-50 transition-transform group-hover:scale-110 duration-700"></div>
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex flex-col">
                <span className="text-sm text-gray-400 font-medium">{dayjs(latest.open_date).format('MM月DD日')} 周{dayjs(latest.open_date).day()}</span>
                <span className="text-2xl font-black text-gray-800">第 {latest.issue} 期</span>
              </div>
              <div className="bg-green-50 px-3 py-1 rounded-full border border-green-100">
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  已开奖
                </span>
              </div>
            </div>

            {/* 号码展示区 */}
            <div className="flex flex-wrap justify-between items-center mb-6 relative z-10 px-1">
              <div className="flex gap-2">
                {latest.numbers.map((n, i) => (
                  <Ball key={i} num={n} size="lg" delay={i * 80} />
                ))}
              </div>
              <div className="text-gray-300 text-2xl font-thin">+</div>
              <Ball num={latest.special_code} size="lg" isSpecial delay={600} />
            </div>

            <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center relative z-10">
              <div className="flex gap-4 text-xs text-gray-500 font-medium">
                <span>特码: <b className="text-gray-800">{latest.special_code}</b></span>
                <span>属性: <b className="text-gray-800">{latest.shengxiao}</b></span>
              </div>
              <div className="text-indigo-500 text-xs font-bold flex items-center gap-1">
                查看走势 <ChevronRight size={14} />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
             <div className="animate-pulse flex flex-col items-center">
               <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
               <div className="flex gap-2 mb-4">
                 {[1,2,3,4,5,6,7].map(i => <div key={i} className="w-10 h-10 bg-gray-200 rounded-full"></div>)}
               </div>
             </div>
          </div>
        )}

        {/* 2. 预测卡片 (金色传说版) */}
        {latest && latest.next_prediction && (
          <div className="relative group">
            {/* 外部发光层 */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 animate-pulse-slow"></div>
            
            <div className="relative bg-gradient-to-b from-[#fffbf0] to-[#fffefb] rounded-2xl p-5 border border-amber-200 shadow-xl overflow-hidden">
               {/* 流光动画 */}
               <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-[-20deg] animate-shimmer pointer-events-none"></div>

               <div className="flex items-center justify-between mb-4 relative z-10">
                 <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-lg shadow-md shadow-orange-200">
                     <Sparkles size={16} fill="white" />
                   </div>
                   <h3 className="font-bold text-gray-800 text-lg">
                     第{parseInt(latest.issue) + 1}期 <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">心水推荐</span>
                   </h3>
                 </div>
                 <div className="px-2 py-0.5 bg-black text-[#ffd700] text-[10px] font-bold rounded uppercase tracking-wider shadow-sm">
                   VIP Access
                 </div>
               </div>

               <div className="flex justify-between px-2 relative z-10">
                 {latest.next_prediction.map((n, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 group/num">
                      <div className="
                        w-10 h-10 rounded-full 
                        bg-gradient-to-b from-white to-amber-50 
                        border-2 border-amber-200 
                        flex items-center justify-center 
                        text-amber-700 font-black text-lg shadow-sm
                        transition-transform group-hover/num:-translate-y-1
                      ">
                        {String(n).padStart(2, '0')}
                      </div>
                    </div>
                 ))}
               </div>
               
               <div className="mt-4 pt-3 border-t border-amber-100 flex justify-center text-amber-800/60 text-[10px]">
                 <p className="flex items-center gap-1">
                   <BarChart3 size={12}/> 基于大数据算法分析 · 仅供参考
                 </p>
               </div>
            </div>
          </div>
        )}

        {/* 3. 历史记录 (极简风) */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
            <span className="font-bold text-gray-700 flex items-center gap-2">
              <History size={18} className="text-indigo-500"/> 往期回顾
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((item) => (
              <div key={item.issue} className="px-5 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between">
                <div className="flex flex-col min-w-[60px]">
                  <span className="text-sm font-bold text-gray-700">#{item.issue}</span>
                  <span className="text-[10px] text-gray-400">{dayjs(item.open_date).format('MM-DD')}</span>
                </div>
                
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pl-2">
                  {item.numbers.map((n, i) => {
                    const color = getWaveColor(n);
                    const bgClass = color === 'red' ? 'bg-red-500' : color === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
                    return (
                      <div key={i} className={`w-6 h-6 rounded-full ${bgClass} flex items-center justify-center text-[10px] text-white font-medium shadow-sm min-w-[24px]`}>
                         {n}
                      </div>
                    )
                  })}
                  <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                  <div className={`w-6 h-6 rounded-full ${getWaveColor(item.special_code) === 'red' ? 'bg-red-500' : getWaveColor(item.special_code) === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'} flex items-center justify-center text-[10px] text-white font-bold shadow-sm min-w-[24px] relative`}>
                    {item.special_code}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
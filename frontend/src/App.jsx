import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { RefreshCw, Trophy, ChevronRight, Zap, ShieldCheck, Target, TrendingUp } from 'lucide-react';

// --- 工具函数 ---
const getBallColorClass = (n) => {
  const red = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46];
  const blue = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48];
  if (red.includes(n)) return 'bg-red-500 ring-red-300';
  if (blue.includes(n)) return 'bg-blue-500 ring-blue-300';
  return 'bg-emerald-500 ring-emerald-300';
};

const getWaveText = (color) => {
  const map = { red: '红波', blue: '蓝波', green: '绿波' };
  return map[color] || color;
};

const getWaveColorBg = (color) => {
  const map = { 
    red: 'bg-red-100 text-red-600 border-red-200', 
    blue: 'bg-blue-100 text-blue-600 border-blue-200', 
    green: 'bg-emerald-100 text-emerald-600 border-emerald-200' 
  };
  return map[color] || 'bg-gray-100';
};

// --- 组件 ---
const Ball = ({ num, size = 'normal', isSpecial = false }) => {
  const colorClass = getBallColorClass(num);
  const sizeClass = size === 'large' ? 'w-10 h-10 text-lg' : 'w-8 h-8 text-sm';
  return (
    <div className={`
      relative flex items-center justify-center rounded-full 
      text-white font-bold shadow-ball
      ring-2 ring-opacity-50
      ${colorClass} ${sizeClass}
    `}>
      <div className="absolute top-1 left-2 w-2 h-1 bg-white opacity-40 rounded-full"></div>
      {String(num).padStart(2, '0')}
      {isSpecial && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-[10px] px-1 rounded font-bold shadow-sm border border-white">
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
  const [loading, setLoading] = useState(false);

  // ⚠️ 请确保您的后端域名正确
  const API_URL = 'https://9526.ip-ddns.com/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resLatest, resHistory] = await Promise.all([
        axios.get(`${API_URL}/latest`),
        axios.get(`${API_URL}/history`)
      ]);
      if(resLatest.data.success) {
        // 处理预测数据，如果是旧格式(数组)则不显示，等待新数据
        const data = resLatest.data.data;
        // 尝试解析 prediction，如果是字符串需 JSON.parse (通常 axios 会自动解析)
        if (typeof data.next_prediction === 'string') {
             try { data.next_prediction = JSON.parse(data.next_prediction); } catch(e){}
        }
        setLatest(data);
      }
      if(resHistory.data.success) setHistory(resHistory.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen max-w-md mx-auto bg-[#f0f2f5] shadow-2xl overflow-hidden pb-20 font-sans">
      
      {/* 顶部栏 */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-4 flex justify-between items-center text-white shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-yellow-300" />
          <h1 className="text-lg font-bold tracking-wider">六合宝典</h1>
        </div>
        <button onClick={fetchData} className="p-2 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition active:scale-95">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      <div className="p-4 space-y-4">

        {/* 1. 最新开奖卡片 */}
        {latest ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-white relative overflow-hidden">
             {/* 装饰 */}
             <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-2xl -z-0"></div>
            
            <div className="flex justify-between items-center mb-5 border-b border-gray-50 pb-3 relative z-10">
              <div className="flex flex-col">
                <span className="text-xs text-gray-400">第 {latest.issue} 期</span>
                <span className="text-xs text-gray-300">{dayjs(latest.open_date).format('MM-DD HH:mm')}</span>
              </div>
              <div className="bg-green-50 text-green-600 px-2 py-1 rounded text-xs font-bold border border-green-100">
                已开奖
              </div>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-2 mb-5 relative z-10">
              {latest.numbers.map((n, i) => <Ball key={i} num={n} size="large" />)}
              <div className="text-gray-300 text-xl font-light mx-1">+</div>
              <Ball num={latest.special_code} size="large" isSpecial />
            </div>

            <div className="flex justify-center gap-4 text-sm text-gray-600 bg-gray-50 py-2 rounded-lg relative z-10">
               <span>特码: <b className="text-gray-900">{latest.special_code}</b></span>
               <span>生肖: <b className="text-gray-900">{latest.shengxiao}</b></span>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">正在加载数据...</div>
        )}

        {/* 2. 智能预测卡片 (仅当数据是新格式对象时显示) */}
        {latest && latest.next_prediction && !Array.isArray(latest.next_prediction) && (
          <div className="bg-white rounded-2xl shadow-sm border border-white overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center gap-2 text-white">
               <Zap size={18} fill="white" />
               <span className="font-bold text-sm">第 {parseInt(latest.issue) + 1} 期 · 独家策略</span>
            </div>
            
            <div className="p-4 grid grid-cols-2 gap-3">
               
               {/* 推荐六肖 */}
               <div className="col-span-2 bg-orange-50 rounded-xl p-3 border border-orange-100">
                  <div className="flex items-center gap-1 text-xs text-orange-600 font-bold mb-2">
                    <Target size={14}/> 推荐六肖
                  </div>
                  <div className="flex justify-between px-2">
                    {latest.next_prediction.liu_xiao.map((sx, i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-white border border-orange-200 flex items-center justify-center text-orange-800 font-bold shadow-sm">
                        {sx}
                      </div>
                    ))}
                  </div>
               </div>

               {/* 主攻三肖 */}
               <div className="col-span-2 flex items-center gap-2 bg-gradient-to-r from-red-50 to-white p-3 rounded-xl border border-red-100">
                   <div className="text-xs font-bold text-red-500 w-16 shrink-0 flex flex-col items-center">
                     <TrendingUp size={16} className="mb-1"/> 主攻三肖
                   </div>
                   <div className="flex-1 flex justify-around">
                      {latest.next_prediction.zhu_san.map((sx, i) => (
                        <span key={i} className="text-lg font-black text-red-600 drop-shadow-sm">{sx}</span>
                      ))}
                   </div>
               </div>

               {/* 波色分析 */}
               <div className="col-span-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="text-xs text-gray-400 mb-2">波色策略</div>
                  <div className="space-y-2">
                    <div className={`text-xs px-2 py-1 rounded border flex justify-between items-center ${getWaveColorBg(latest.next_prediction.zhu_bo)}`}>
                       <span className="opacity-70">主攻</span>
                       <span className="font-bold">{getWaveText(latest.next_prediction.zhu_bo)}</span>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded border flex justify-between items-center ${getWaveColorBg(latest.next_prediction.fang_bo)}`}>
                       <span className="opacity-70">防守</span>
                       <span className="font-bold">{getWaveText(latest.next_prediction.fang_bo)}</span>
                    </div>
                  </div>
               </div>

               {/* 大小单双 */}
               <div className="col-span-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="text-xs text-gray-400 mb-2">形态预测</div>
                  <div className="grid grid-cols-2 gap-2 h-[calc(100%-24px)]">
                     <div className="bg-white rounded border border-gray-200 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-xs text-gray-400">特码</span>
                        <span className="font-black text-indigo-600 text-lg">{latest.next_prediction.da_xiao}</span>
                     </div>
                     <div className="bg-white rounded border border-gray-200 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-xs text-gray-400">形态</span>
                        <span className="font-black text-purple-600 text-lg">{latest.next_prediction.dan_shuang}</span>
                     </div>
                  </div>
               </div>

            </div>
          </div>
        )}

        {/* 3. 历史记录 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 font-bold text-gray-600 text-sm flex items-center gap-2">
            <ShieldCheck size={16}/> 往期数据
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((item) => (
              <div key={item.issue} className="p-3 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex flex-col w-16">
                  <span className="text-xs font-bold text-gray-700">#{item.issue}</span>
                  <span className="text-[10px] text-gray-400">{item.shengxiao} / {getWaveText(getBallColorClass(item.special_code).includes('red')?'red':getBallColorClass(item.special_code).includes('blue')?'blue':'green')}</span>
                </div>
                <div className="flex gap-1 flex-1 justify-end">
                  {item.numbers.map((n, idx) => (
                    <Ball key={idx} num={n} size="normal" />
                  ))}
                  <div className="w-px h-6 bg-gray-200 mx-1"></div>
                  <Ball num={item.special_code} size="normal" />
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
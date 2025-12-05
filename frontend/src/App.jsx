import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { 
  RefreshCw, Trophy, ChevronRight, Zap, ChevronLeft, 
  Sparkles, LayoutGrid, ChevronDown, ChevronUp, 
  Waves, Scale, Grid, Ban, Flame, Crosshair,
  Gem, Star, MousePointer2 
} from 'lucide-react';

// --- 基础工具 ---
const getBallColorClass = (n) => {
  const red = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46];
  const blue = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48];
  if (red.includes(n)) return 'bg-red-500 ring-red-300';
  if (blue.includes(n)) return 'bg-blue-500 ring-blue-300';
  return 'bg-emerald-500 ring-emerald-300';
};

// 球体组件
const Ball = ({ num, size = 'normal', isSpecial = false, showZodiac = false, zodiac = '' }) => {
  const colorClass = getBallColorClass(num);
  const sizeClass = size === 'large' ? 'w-10 h-10 text-lg' : (size === 'small' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm');
  
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`relative flex items-center justify-center rounded-full text-white font-bold shadow-ball ring-2 ring-opacity-50 ${colorClass} ${sizeClass}`}>
        <div className="absolute top-1 left-2 w-2 h-1 bg-white opacity-40 rounded-full"></div>
        {String(num).padStart(2, '0')}
        {isSpecial && (<div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 text-[9px] px-1 rounded font-bold shadow-sm border border-white">特</div>)}
      </div>
      {showZodiac && zodiac && <span className="text-[10px] text-gray-500 font-medium">{zodiac}</span>}
    </div>
  );
};

// 预测卡片组件 (V5.5 Pro 适配)
const PredictionCard = ({ data, isHistory = false }) => {
  if (!data) return <div className="text-xs text-gray-400 p-2">暂无预测数据</div>;

  const waveStyles = {
    red: { label: '红波', class: 'text-red-600 bg-red-50 border-red-200' },
    blue: { label: '蓝波', class: 'text-blue-600 bg-blue-50 border-blue-200' },
    green: { label: '绿波', class: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
  };

  return (
    <div className={`space-y-4 ${isHistory ? 'bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2 text-xs' : ''}`}>
      {isHistory && <div className="text-gray-400 text-[10px] font-medium mb-2">预测存档 (V5.5 Pro)</div>}

      {/* 1. 一肖一码 (全阵网格) */}
      {data.zodiac_one_code && Array.isArray(data.zodiac_one_code) && (
        <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
           <div className="flex items-center gap-1 mb-3 text-indigo-800 font-bold text-xs justify-center">
              <MousePointer2 size={14} className="text-indigo-500"/> 一肖一码全阵 (12码)
           </div>
           <div className="grid grid-cols-6 gap-y-3 gap-x-1 justify-items-center">
              {data.zodiac_one_code.map((item, i) => (
                 <div key={i} className="flex flex-col items-center">
                    <Ball num={item.num} size="small" />
                    <span className="text-[10px] text-gray-500 mt-0.5">{item.zodiac}</span>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* 2. 精选平码 & 特码前五 */}
      <div className="grid grid-cols-1 gap-3">
          {/* 平码推荐 */}
          {data.normal_numbers && Array.isArray(data.normal_numbers) && (
            <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                <div className="flex items-center gap-1 mb-2 text-blue-700 font-bold text-xs">
                    <Gem size={14} className="text-blue-500"/> 精选平码 (六码)
                </div>
                <div className="flex justify-between px-1">
                    {data.normal_numbers.map((n, i) => (
                        <Ball key={i} num={n.num} size="small" showZodiac zodiac={n.zodiac} />
                    ))}
                </div>
            </div>
          )}

          {/* 特码推荐 */}
          {data.special_numbers && Array.isArray(data.special_numbers) && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-3 rounded-xl border border-amber-100 shadow-sm">
                <div className="flex items-center gap-1 mb-2 text-amber-700 font-bold text-xs">
                    <Star size={14} className="text-amber-500"/> 特码前五 (高分)
                </div>
                <div className="flex justify-center gap-4">
                    {data.special_numbers.map((n, i) => (
                        <div key={i} className="relative">
                            <Ball num={n.num} size="normal" />
                            {i===0 && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] bg-red-500 text-white px-1.5 rounded-full shadow-sm whitespace-nowrap">首推</div>}
                        </div>
                    ))}
                </div>
            </div>
          )}
      </div>

      {/* 3. 五肖中特 (大字报) */}
      <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center relative overflow-hidden">
          <div className="absolute -right-2 -top-2 opacity-10"><Flame size={64}/></div>
          <div className="text-xs text-red-500 font-bold mb-2 tracking-wider flex items-center justify-center gap-1">
             <Flame size={14}/> 五肖中特 (主攻前三)
          </div>
          <div className="flex justify-center gap-3 md:gap-5 relative z-10">
              {data.liu_xiao && data.liu_xiao.slice(0, 5).map((z, i) => (
                  <div key={i} className="flex flex-col items-center">
                     <span className={`text-xl font-black ${i<3 ? 'text-red-600 scale-110' : 'text-gray-600'}`}>{z}</span>
                     {i < 3 && <div className="h-1 w-full bg-red-300 rounded-full mt-1"></div>}
                  </div>
              ))}
          </div>
      </div>

      {/* 4. 围捕数据 (四宫格) */}
      <div className="grid grid-cols-2 gap-2 text-xs">
           <div className="bg-gray-100 p-2 rounded-lg flex flex-col items-center justify-center">
               <span className="text-gray-400 mb-1 flex items-center gap-1"><Ban size={10}/> 绝杀三肖</span>
               <div className="flex gap-1.5">
                  {data.kill_zodiacs?.map((z,i) => <span key={i} className="font-bold text-gray-400 line-through decoration-red-400 decoration-2">{z}</span>)}
               </div>
           </div>
           
           <div className="bg-white border border-gray-200 p-2 rounded-lg flex flex-col items-center justify-center">
               <span className="text-gray-400 mb-1 flex items-center gap-1"><Crosshair size={10}/> 推荐尾数</span>
               <span className="font-black text-indigo-600 tracking-widest">{data.rec_tails?.join('.') || '?'}</span>
           </div>

           <div className="bg-white border border-gray-200 p-2 rounded-lg flex flex-col items-center justify-center">
               <span className="text-gray-400 mb-1">主/防头数</span>
               <span className="font-bold text-gray-700">{data.hot_head}头 <span className="text-gray-300">|</span> {data.fang_head}头</span>
           </div>

           <div className="bg-white border border-gray-200 p-2 rounded-lg flex flex-col items-center justify-center">
               <span className="text-gray-400 mb-1">波色策略</span>
               <div className="flex gap-1">
                   <span className={`${waveStyles[data.zhu_bo]?.class} px-1.5 rounded font-bold`}>主</span>
                   <span className="text-gray-400">/</span>
                   <span className="text-gray-500 font-medium">防{waveStyles[data.fang_bo]?.label?.replace('波','')}</span>
               </div>
           </div>
      </div>
    </div>
  );
};

// --- 主程序 ---
function App() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [expandedRows, setExpandedRows] = useState({});

  const API_URL = 'https://9526.ip-ddns.com/api';
  const safeParse = (str) => { if (typeof str === 'object') return str; try { return JSON.parse(str); } catch (e) { return null; } };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resLatest, resHistory] = await Promise.all([ axios.get(`${API_URL}/latest`), axios.get(`${API_URL}/history`) ]);
      if(resLatest.data.success) {
        const data = resLatest.data.data;
        data.next_prediction = safeParse(data.deep_prediction) || safeParse(data.next_prediction);
        setLatest(data);
      }
      if(resHistory.data.success) {
        setHistory(resHistory.data.data.map(item => ({ ...item, next_prediction: safeParse(item.deep_prediction) || safeParse(item.next_prediction) })));
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
  const currentHistory = history.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const toggleRow = (id) => { setExpandedRows(prev => ({ ...prev, [id]: !prev[id] })); };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-[#f8f9fa] shadow-2xl overflow-hidden pb-12 font-sans">
      
      {/* 顶部导航 */}
      <div className="bg-indigo-600 px-5 py-4 flex justify-between items-center text-white shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
             <Trophy size={18} className="text-yellow-300" />
          </div>
          <div>
             <h1 className="text-lg font-bold tracking-wide leading-none">六合天机</h1>
             <p className="text-[10px] text-indigo-200 opacity-80">V5.5 Pro Edition</p>
          </div>
        </div>
        <button onClick={fetchData} className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition active:scale-95 border border-white/10">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      <div className="p-4 space-y-6">
        
        {/* 最新开奖卡片 */}
        {latest ? (
          <div className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl -z-0 opacity-60"></div>
            
            <div className="flex justify-between items-end mb-5 relative z-10 border-b border-gray-50 pb-3">
              <div>
                 <span className="text-xs text-gray-400 block mb-0.5">最新开奖</span>
                 <span className="text-2xl font-black text-gray-800 tracking-tight">第 {latest.issue} 期</span>
              </div>
              <div className="text-right">
                 <span className="text-xs text-gray-400 block mb-0.5">{dayjs(latest.open_date).format('YYYY-MM-DD')}</span>
                 <span className="bg-green-50 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-green-100">已开奖</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-y-3 mb-5 relative z-10 px-1">
              <div className="flex gap-1.5 md:gap-2">
                 {latest.numbers.map((n, i) => (<Ball key={i} num={n} size="large" />))}
              </div>
              <div className="text-gray-300 text-2xl font-thin pb-1">+</div>
              <Ball num={latest.special_code} size="large" isSpecial />
            </div>

            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-xs text-gray-600 relative z-10">
               <div className="flex gap-4 font-medium">
                 <span>特码: <b className="text-gray-900 text-sm">{latest.special_code}</b></span>
                 <span>生肖: <b className="text-gray-900 text-sm">{latest.shengxiao}</b></span>
               </div>
               <div className="flex items-center gap-1 text-indigo-500 cursor-pointer hover:underline">
                  走势分析 <ChevronRight size={12}/>
               </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl">正在加载数据...</div>
        )}

        {/* 智能预测区域 */}
        {latest && latest.next_prediction && (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-pink-500 rounded-2xl blur opacity-20 translate-y-2"></div>
            <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-pink-500"></div>
              
              <div className="flex items-center justify-between mb-4 mt-1">
                <div className="flex items-center gap-2 text-gray-800 font-bold text-lg">
                  <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><Sparkles size={18}/></div>
                  <span>第 {parseInt(latest.issue) + 1} 期 智能决策</span>
                </div>
                <span className="text-[10px] bg-gray-900 text-yellow-400 px-2 py-0.5 rounded font-bold">V5.5 PRO</span>
              </div>

              <PredictionCard data={latest.next_prediction} />
              
              <div className="mt-4 pt-3 border-t border-gray-50 text-[10px] text-center text-gray-400 flex justify-center items-center gap-1">
                 <Zap size={10}/> 数据仅供参考，请理性购彩
              </div>
            </div>
          </div>
        )}

        {/* 历史记录列表 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
            <span className="flex items-center gap-2 font-bold text-gray-700 text-sm"><LayoutGrid size={16} className="text-indigo-500"/> 往期记录</span>
            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Total: {history.length}</span>
          </div>
          
          <div className="divide-y divide-gray-50 min-h-[300px]">
            {currentHistory.map((item) => (
              <div key={item.id} className="group p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col">
                       <span className="text-sm font-bold text-gray-800">第 {item.issue} 期</span>
                       <span className="text-[10px] text-gray-400">{dayjs(item.open_date).format('MM-DD')}</span>
                    </div>
                    <button 
                      onClick={() => toggleRow(item.id)} 
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${expandedRows[item.id] ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-indigo-500'}`}
                    >
                      <span>{expandedRows[item.id] ? '收起预测' : '查看预测'}</span>
                      {expandedRows[item.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
                
                <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                   {item.numbers.map((n, idx) => (<Ball key={idx} num={n} size="normal" />))}
                   <div className="w-px h-6 bg-gray-200 mx-1 self-center"></div>
                   <Ball num={item.special_code} size="normal" />
                </div>

                {expandedRows[item.id] && (
                  <div className="mt-4 pt-4 border-t border-dashed border-gray-200 animate-fade-in">
                    <PredictionCard data={item.next_prediction} isHistory={true} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 分页 */}
          {history.length > 0 && (
            <div className="flex justify-between items-center p-4 border-t border-gray-100 bg-gray-50/30">
              <button onClick={() => setCurrentPage(c => c-1)} disabled={currentPage===1} className="flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition"><ChevronLeft size={14} className="mr-1"/> 上一页</button>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(c => c+1)} disabled={currentPage===totalPages} className="flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition">下一页 <ChevronRight size={14} className="ml-1"/></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;


import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Game } from './Game';
import * as api from '../services/api';

// 搜索和赠送积分的模态框
const TransferModal = ({ onClose, reloadUser }) => {
    const [searchPhone, setSearchPhone] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState('');
    const [amount, setAmount] = useState('');
    const [transferStatus, setTransferStatus] = useState({ message: '', error: '' });

    const handleSearch = async () => {
        setSearchError('');
        setSearchResult(null);
        if (!searchPhone) return;
        try {
            const res = await api.searchUserByPhone(searchPhone);
            if (res.success) {
                setSearchResult(res.user);
            } else {
                setSearchError(res.message);
            }
        } catch (err) {
            setSearchError(err.message);
        }
    };

    const handleTransfer = async () => {
        setTransferStatus({ message: '', error: '' });
        const transferAmount = parseInt(amount, 10);
        if (!searchResult || !transferAmount || transferAmount <= 0) {
            setTransferStatus({ error: '请输入有效的金额和接收用户。' });
            return;
        }

        try {
            const res = await api.transferPoints(searchResult.public_id, transferAmount);
            if (res.success) {
                setTransferStatus({ message: `成功赠送 ${transferAmount} 积分给 ${searchResult.phone_number}!` });
                reloadUser(); // 刷新用户数据
                setSearchResult(null); // 清空结果
                setSearchPhone('');
                setAmount('');
            } else {
                setTransferStatus({ error: res.message });
            }
        } catch (err) {
            setTransferStatus({ error: err.message });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold">搜索用户 & 赠送积分</h2>
                {/* 状态消息 */}
                {transferStatus.message && <p className="text-green-400">{transferStatus.message}</p>}
                {transferStatus.error && <p className="text-red-400">{transferStatus.error}</p>}
                
                {/* 搜索部分 */}
                <div className="flex gap-2">
                    <input 
                        type="tel" 
                        placeholder="输入对方手机号" 
                        value={searchPhone}
                        onChange={e => setSearchPhone(e.target.value)}
                        className="flex-grow bg-gray-700 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <button onClick={handleSearch} className="bg-blue-500 px-4 rounded-md">搜索</button>
                </div>
                {searchError && <p className="text-red-500 text-sm">{searchError}</p>}
                
                {/* 结果和赠送部分 */}
                {searchResult && (
                    <div className="bg-gray-700/50 p-4 rounded-lg space-y-3">
                        <p>用户ID: <span className="font-mono font-bold">{searchResult.public_id}</span></p>
                        <p>手机号: {searchResult.phone_number}</p>
                        <div className="flex gap-2">
                            <input 
                                type="number"
                                placeholder="赠送积分数量"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="flex-grow bg-gray-600 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                            <button onClick={handleTransfer} className="bg-yellow-500 text-black px-4 rounded-md font-bold">确认赠送</button>
                        </div>
                    </div>
                )}
                 <button onClick={onClose} className="w-full bg-gray-600 py-2 rounded-md mt-2">关闭</button>
            </div>
        </div>
    );
};


export const Dashboard = () => {
  const { user, logout, reloadUser } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const handleGameEnd = () => {
    setIsPlaying(false);
    reloadUser(); // 游戏结束后刷新用户信息以更新积分
  };

  if (isPlaying) {
    return <Game onGameEnd={handleGameEnd} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
        <header className="flex justify-between items-center mb-8">
            <div className="text-sm">
                <p className="font-bold">ID: <span className="font-mono text-yellow-400">{user.public_id}</span></p>
                <p>{user.phone_number}</p>
            </div>
            <button onClick={logout} className="text-sm bg-red-500/80 px-3 py-1 rounded-md">登出</button>
        </header>

        <main className="text-center space-y-10">
            <div>
                <p className="text-gray-400 text-sm">当前积分</p>
                <p className="text-5xl font-black text-yellow-400 tracking-tighter">{user.points}</p>
            </div>

            <div className="max-w-sm mx-auto space-y-4">
                <button 
                    onClick={() => setIsPlaying(true)} 
                    className="w-full py-5 rounded-2xl text-xl font-black transition-all duration-300 bg-green-500 text-black hover:bg-green-400"
                >
                    开始对局
                </button>
                 <button 
                    onClick={() => setShowTransferModal(true)} 
                    className="w-full py-3 rounded-2xl text-lg font-bold transition-all duration-300 bg-blue-500 text-black hover:bg-blue-400"
                >
                    搜索 & 赠送积分
                </button>
            </div>
        </main>

        {showTransferModal && <TransferModal onClose={() => setShowTransferModal(false)} reloadUser={reloadUser} />}
    </div>
  );
};

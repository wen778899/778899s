
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      let response;
      if (isLogin) {
        response = await login(phoneNumber, password);
      } else {
        response = await register(phoneNumber, password);
        if(response.success) {
            setMessage('注册成功！请登录。');
            setIsLogin(true); // 切换到登录视图
        }
      }
      
      if (response && !response.success) {
        setError(response.message);
      }

    } catch (err) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">{isLogin ? '登录' : '注册'}</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400">手机号</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {message && <p className="text-sm text-green-500">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 font-bold text-black bg-yellow-500 rounded-md hover:bg-yellow-600 disabled:bg-gray-600"
          >
            {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
          </button>
        </form>
        <p className="text-sm text-center">
          {isLogin ? '还没有账户？' : '已有账户？'}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }} className="ml-2 font-medium text-yellow-500 hover:underline">
            {isLogin ? '立即注册' : '立即登录'}
          </button>
        </p>
      </div>
    </div>
  );
};

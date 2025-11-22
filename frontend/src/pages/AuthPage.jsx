import React, { useState } from 'react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login(email, password);
        navigate('/emails');
      } else {
        const res = await api.register(email, password);
        alert(res.message);
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="card">
      <h2>{isLogin ? '登录' : '注册'}</h2>
      <form onSubmit={handleSubmit}>
        <input 
          type="email" 
          placeholder="邮箱" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="密码" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          required 
        />
        <button type="submit" style={{width: '100%'}}>
          {isLogin ? '登录' : '注册'}
        </button>
      </form>
      <div style={{marginTop: '1rem', textAlign: 'center'}}>
        <button className="btn-text" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? '没有账号？去注册' : '已有账号？去登录'}
        </button>
      </div>
    </div>
  );
}

export default AuthPage;
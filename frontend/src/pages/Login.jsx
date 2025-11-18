// 文件路径: frontend/src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { loginUser } from '../services/api';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await loginUser({ phone, password });
      login(response.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '登录失败');
    }
  };

  return (
    <div className="container">
      <h1>登录</h1>
      <form className="auth-container" onSubmit={handleSubmit}>
        <input type="tel" placeholder="手机号" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">登录</button>
        <p>还没有账号？ <Link to="/register">立即注册</Link></p>
      </form>
    </div>
  );
};

export default Login;
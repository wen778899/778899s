
// 文件路径: frontend/src/pages/Register.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/api';

const Register = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 6) {
      setError('密码长度至少6位');
      return;
    }
    try {
      await registerUser({ phone, password });
      setSuccess('注册成功！正在跳转到登录页面...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || '注册失败');
    }
  };

  return (
    <div className="container">
      <h1>注册</h1>
      <form className="auth-container" onSubmit={handleSubmit}>
        <input type="tel" placeholder="手机号" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input type="password" placeholder="密码 (至少6位)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}
        <button type="submit">注册</button>
        <p>已有账号？ <Link to="/login">返回登录</Link></p>
      </form>
    </div>
  );
};

export default Register;
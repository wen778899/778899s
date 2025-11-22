import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { api } from './api';
import './index.css';

// 页面组件导入 (你可以把这些代码分文件，这里为了展示放在一起)
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import EmailsPage from './pages/EmailsPage';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.checkSession()
      .then(res => {
        if (res.isAuthenticated) setUser(res.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    if (res.status === 'success') setUser(res.user);
    return res;
  };

  const logout = () => {
    api.logout().then(() => setUser(null));
  };

  if (loading) return <div className="loading-screen">系统加载中...</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <HashRouter>
        <div className="app-container">
          <NavBar />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/emails" element={
                <RequireAuth><EmailsPage /></RequireAuth>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AuthContext.Provider>
  );
}

function NavBar() {
  const { user, logout } = useAuth();
  return (
    <nav className="navbar">
      <div className="brand">
        <Link to="/">📊 结算系统</Link>
      </div>
      <div className="links">
        {user ? (
          <>
            <Link to="/emails">邮件</Link>
            <button onClick={logout} className="btn-text">退出</button>
          </>
        ) : (
          <Link to="/auth">登录</Link>
        )}
      </div>
    </nav>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

export default App;
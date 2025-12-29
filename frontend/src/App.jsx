
import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';

// AppContent 组件根据认证状态决定显示哪个页面
const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // 在验证 token 期间显示全局加载动画
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white text-lg">正在加载...</p>
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <AuthPage />;
};

// App 是应用的根组件，包裹了 AuthProvider
const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;

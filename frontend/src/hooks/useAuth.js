
import React, { useState, createContext, useContext, useEffect, useCallback } from 'react';
import * as api from '../services/api';

// 1. 创建认证上下文
const AuthContext = createContext(null);

// 2. 创建认证 Provider 组件
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // 初始加载状态

  // 检查本地存储中是否有 Token，并用它来获取用户信息
  const loadUserFromToken = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        const response = await api.getCurrentUser();
        if (response.success) {
          setUser(response.user);
        } else {
          // 如果 Token 无效或过期，则清除它
          localStorage.removeItem('authToken');
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
        localStorage.removeItem('authToken');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUserFromToken();
  }, [loadUserFromToken]);

  // 登录函数
  const login = async (phoneNumber, password) => {
    try {
      const response = await api.login(phoneNumber, password);
      if (response.success) {
        localStorage.setItem('authToken', response.token);
        await loadUserFromToken(); // 重新加载用户信息
        return response;
      }
    } catch (error) {
      return error; // 将 API 返回的错误信息传递给调用者
    }
  };

  // 注册函数
  const register = async (phoneNumber, password) => {
    try {
        return await api.register(phoneNumber, password);
    } catch (error) {
        return error;
    }
  };
  
  // 登出函数
  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };
  
  // 提供给后代组件的值
  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
    reloadUser: loadUserFromToken, // 提供一个刷新用户信息的接口
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 3. 创建一个自定义钩子，方便地访问认证上下文
export const useAuth = () => {
  return useContext(AuthContext);
};

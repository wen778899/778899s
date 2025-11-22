// 【关键修改】API_BASE_URL 留空或者是 '/api'
// 这样请求就会发向 https://88.9526.ip-ddns.com/api/...
// 然后被 _worker.js 拦截并转发
const API_BASE_URL = '/api';

async function request(endpoint, options = {}) {
  // 拼接 endpoint，例如 /api/login
  // 注意：这里手动拼接斜杠，确保路径正确
  const url = `${API_BASE_URL}/${endpoint}`;
  
  const defaultOptions = {
    // mode: 'cors', // 同源代理不需要 cors 模式，或者保持 cors 也没关系
    credentials: 'include', // 关键：必须携带 Cookie
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      }
    });

    // 处理网络层面的非 200 错误
    if (!response.ok && response.status !== 400 && response.status !== 401 && response.status !== 403) {
       throw new Error(`HTTP Error: ${response.status}`);
    }

    // 尝试解析 JSON
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("API Parse Error, received:", text);
        throw new Error("服务器返回了非 JSON 格式的数据");
    }
  
    if (response.status === 401) {
      // 简单的 hash 路由跳转检查
      if (!window.location.hash.includes('auth')) {
        window.location.hash = '#/auth';
      }
      throw new Error(data.message || '请先登录');
    }

    if (data.status === 'error') {
      throw new Error(data.message);
    }

    return data;

  } catch (error) {
    console.error("Request Failed:", error);
    throw error;
  }
}

export const api = {
  login: (email, password) => request('login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password) => request('register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  checkSession: () => request('check_session'),
  logout: () => request('logout'),
  getEmails: () => request('get_emails'),
  getLotteryResults: () => request('get_lottery_results'),
};
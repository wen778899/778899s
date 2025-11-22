// frontend/src/api.js

// 后端地址，注意不要带末尾斜杠
const API_BASE_URL = 'http://9526.ip-ddns.com/index.php';

async function request(endpoint, options = {}) {
  // 拼接 endpoint
  const url = `${API_BASE_URL}?endpoint=${endpoint}`;
  
  const defaultOptions = {
    mode: 'cors', // 关键
    credentials: 'include', // 关键：携带 Cookie
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    }
  });

  const data = await response.json();
  
  if (response.status === 401) {
    // 处理未登录
    if (!window.location.hash.includes('auth')) {
      window.location.hash = '#/auth';
    }
    throw new Error('请先登录');
  }

  if (data.status === 'error') {
    throw new Error(data.message);
  }

  return data;
}

export const api = {
  login: (email, password) => request('login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password) => request('register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  checkSession: () => request('check_session'),
  logout: () => request('logout'),
  getEmails: () => request('get_emails'),
  getLotteryResults: () => request('get_lottery_results'),
  // ... 其他接口 ...
};
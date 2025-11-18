// 文件路径: frontend/src/services/api.js
import axios from 'axios';

const api = axios.create({
  // URL将通过_worker.js代理，所以我们使用相对路径
  baseURL: '/api',
  withCredentials: true // 确保sessionId cookie被发送
});

// Auth
export const registerUser = (data) => api.post('/user/register.php', data);
export const loginUser = (data) => api.post('/user/login.php', data);
export const fetchMe = () => api.get('/user/me.php');

// Game
export const joinGame = (score) => api.post('/game/join.php', { score });
export const submitHand = (gameId, hand) => api.post('/game/submit.php', { gameId, hand });
export const fetchGameStatus = (gameId) => api.get(`/game/status.php?gameId=${gameId}`);

export default api;
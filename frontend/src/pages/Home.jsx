// 文件路径: frontend/src/pages/Home.jsx
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { joinGame } from '../services/api';
import useGameStore from '../store/gameStore';
import { mapCardIdsToObjects } from '../utils/cardUtils';

const Home = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const setInitialCards = useGameStore((state) => state.setInitialCards);

  const handleJoin = async (score) => {
    try {
      const { data } = await joinGame(score);
      
      const mappedCards = {
        head: mapCardIdsToObjects(data.cards.head),
        middle: mapCardIdsToObjects(data.cards.middle),
        tail: mapCardIdsToObjects(data.cards.tail),
      };

      setInitialCards(data.gameId, mappedCards);
      navigate(`/game/${score}`);
    } catch (error) {
      alert(error.response?.data?.error || `进入 ${score} 分场失败`);
    }
  };

  return (
    <div className="container">
      <header className="home-header">
        <span>ID: {user?.public_id}</span>
        <span>积分: {user?.points}</span>
      </header>
      <main className="score-selection">
        <div className="score-card" onClick={() => handleJoin(2)}>2 分场</div>
        <div className="score-card" onClick={() => handleJoin(5)}>5 分场</div>
        <div className="score-card" onClick={() => handleJoin(10)}>10 分场</div>
      </main>
    </div>
  );
};

export default Home;
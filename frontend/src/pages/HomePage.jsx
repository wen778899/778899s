import React, { useState, useEffect } from 'react';
import { api } from '../api';

function HomePage() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLotteryResults()
      .then(res => setResults(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card">加载开奖数据中...</div>;

  return (
    <div className="home-page">
      <h2>🏆 最新开奖</h2>
      {results && Object.keys(results).map(type => {
        const item = results[type];
        if (!item) return null;
        return (
          <div key={type} className="card">
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                <strong>{type}</strong>
                <span style={{color:'#666', fontSize:'0.9rem'}}>第 {item.issue_number} 期</span>
            </div>
            <div className="balls-container">
              {item.winning_numbers.map((num, idx) => (
                <div key={idx} className={`lottery-ball ${getBallColor(item.colors[idx])}`}>
                  {num}
                </div>
              ))}
            </div>
            <div style={{marginTop:'5px', fontSize:'0.8rem', color:'#888', display:'flex', justifyContent:'space-around'}}>
                {item.zodiac_signs.map((z, i) => <span key={i}>{z}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getBallColor(colorName) {
    if(colorName === '红波') return 'ball-red';
    if(colorName === '绿波') return 'ball-green';
    if(colorName === '蓝波') return 'ball-blue';
    return 'ball-blue';
}

export default HomePage;
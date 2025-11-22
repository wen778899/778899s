import React, { useState, useEffect } from 'react';
import { api } from '../api';

function EmailsPage() {
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    api.getEmails().then(res => setEmails(res.data));
  }, []);

  return (
    <div>
      <h2>📬 邮件列表</h2>
      {emails.length === 0 ? <p className="card">暂无邮件</p> : null}
      
      {emails.map(email => (
        <div key={email.id} className="card">
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <span>ID: {email.id}</span>
            <span className={`status-${email.status}`}>{email.status}</span>
          </div>
          <div style={{color:'#666', fontSize:'0.85rem', marginTop:'0.5rem'}}>
            时间: {email.received_at}
          </div>
          <div style={{marginTop:'1rem', borderTop:'1px solid #eee', paddingTop:'0.5rem'}}>
             <button className="btn-text" onClick={() => alert('详情功能待后端完善')}>查看详情/解析</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default EmailsPage;
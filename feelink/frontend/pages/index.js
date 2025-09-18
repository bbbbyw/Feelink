import { useState } from 'react';

export default function Home() {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  const send = async () => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setText('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userMsg.text })
      });
      const data = await res.json();
      const botText = `Emotion: ${data.emotion} (confidence ${Math.round((data.confidence || 0)*100)}%)\nActivity: ${data.activity}\nEncouragement: ${data.encouragement}`;
      const botMsg = { role: 'bot', text: botText };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#cc64c7', padding: 20 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 8, padding: 20 }}>
        <h1>Feelink</h1>
        <div style={{ height: 320, overflow: 'auto', border: '1px solid #eee', padding: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ textAlign: m.role === 'user' ? 'right' : 'left', margin: '8px 0' }}>
              <div style={{ display: 'inline-block', background: m.role === 'user' ? '#fde68a' : '#e6f4ff', padding: 10, borderRadius: 6 }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.text}</pre>
              </div>
            </div>
          ))}
          {loading && <div>Bot is typing...</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, padding: 8 }} />
          <button onClick={send} style={{ padding: '8px 16px' }}>Send</button>
        </div>
      </div>
    </div>
  );
} 
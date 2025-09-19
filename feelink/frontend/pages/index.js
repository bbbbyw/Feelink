import { useState } from 'react';
import { upsertEntryByDate } from "../src/lib/storage";

export default function Home() {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [taskDone, setTaskDone] = useState(false);
  const [satisfaction, setSatisfaction] = useState('');

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
      setLastResult(data);
      setTaskDone(false);
      setSatisfaction('');
      const botText = `Emotion: ${data.emotion} (confidence ${Math.round((data.confidence || 0)*100)}%)\nActivity: ${data.activity}\nEncouragement: ${data.encouragement}`;
      const botMsg = { role: 'bot', text: botText };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  const setAsDayMood = () => {
    if (!lastResult) return;
    const today = new Date();
    const dateStr = today.toISOString().slice(0,10);
    upsertEntryByDate(dateStr, {
      date: dateStr,
      emotion: lastResult.emotion,
      activity: lastResult.activity,
      encouragement: lastResult.encouragement,
      taskDone,
      satisfaction
    });
  };

  return (
    <div className="min-h-screen bg-purple-400 p-5 flex items-center justify-center">
      <div className="w-full max-w-screen-2xl mx-auto bg-white rounded-lg p-4 lg:p-8 shadow">
        <h1 className="text-2xl font-semibold mb-3">Feelink</h1>
        <div className="h-[70vh] overflow-auto border border-gray-200 p-3 rounded">
          {messages.map((m, i) => (
            <div key={i} className={`my-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block px-3 py-2 rounded ${m.role === 'user' ? 'bg-amber-200' : 'bg-blue-50'}`}>
                <pre className="m-0 whitespace-pre-wrap">{m.text}</pre>
              </div>
            </div>
          ))}
          {loading && <div className="text-sm text-gray-500">Bot is typing...</div>}
        </div>

        {lastResult && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-gray-700">
              <div><span className="font-medium">Detected:</span> {lastResult.emotion}</div>
              <div><span className="font-medium">Task:</span> {lastResult.activity}</div>
              <div><span className="font-medium">Note:</span> {lastResult.encouragement}</div>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4" checked={taskDone} onChange={(e)=>setTaskDone(e.target.checked)} />
                Mark task as done
              </label>
              <select value={satisfaction} onChange={(e)=>setSatisfaction(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
                <option value="">Satisfaction...</option>
                <option>Not better</option>
                <option>A bit better</option>
                <option>Much better</option>
              </select>
              <button onClick={setAsDayMood} className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm">Set as Day Mood</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <input value={text} onChange={(e) => setText(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-purple-300" />
          <button onClick={send} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-white ">Send</button>
        </div>

        <div className="mt-4 text-right">
          <a href="/journal" className="text-sm text-purple-700 hover:underline">Open Mood Journal →</a>
        </div>
      </div>
    </div>
  );
} 
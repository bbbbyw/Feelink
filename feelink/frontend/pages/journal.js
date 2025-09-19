import { useEffect, useState } from "react";
import { loadEntries } from "../src/lib/storage";

export default function Journal() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    setEntries(loadEntries().sort((a,b) => (a.date < b.date ? 1 : -1)));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-5">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Mood Journal</h1>
          <a href="/" className="text-sm text-purple-700 hover:underline">← Back to chat</a>
        </div>
        {entries.length === 0 && (
          <div className="text-gray-600">No entries yet. Chat with the bot and click "Set as Day Mood".</div>
        )}
        <div className="grid gap-3">
          {entries.map((e, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded p-4 shadow">
              <div className="text-sm text-gray-500">{e.date}</div>
              <div className="mt-1"><span className="font-medium">Mood:</span> {e.emotion || '-'}</div>
              <div className="mt-1"><span className="font-medium">Task:</span> {e.activity || '-'} {e.taskDone ? '✅' : '⬜'}</div>
              <div className="mt-1"><span className="font-medium">Satisfaction:</span> {e.satisfaction || '-'}</div>
              <div className="mt-1 text-gray-600">{e.encouragement}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 
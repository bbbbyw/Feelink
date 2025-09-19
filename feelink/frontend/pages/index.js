import { useState, useEffect } from 'react';
import { saveMood, getMoods, updateMood, getToday, deleteMood } from '../lib/storage';

export default function Home() {
  // Chat state
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  
  // UI state
  const [showJournal, setShowJournal] = useState(false);
  const [journalFilter, setJournalFilter] = useState('all');
  const [moods, setMoods] = useState([]);
  const [todayMood, setTodayMood] = useState(null);
  const [toast, setToast] = useState('');
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    loadMoods();
    loadTodayMood();
  }, []);

  const loadMoods = () => {
    setMoods(getMoods().sort((a, b) => b.date.localeCompare(a.date)));
  };

  const loadTodayMood = () => {
    setTodayMood(getToday());
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    
    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setText('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userMsg.text })
      });
      
      const data = await response.json();
      setLastResult(data);
      
      const botText = `Emotion: ${data.emotion} (${Math.round(data.confidence * 100)}%)\nActivity: ${data.activity}\nEncouragement: ${data.encouragement}`;
      const botMsg = { role: 'bot', text: botText };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const setAsDayMood = () => {
    if (!lastResult) return;
    
    const today = new Date().toISOString().slice(0, 10);
    const entry = {
      date: today,
      emotion: lastResult.emotion,
      activity: lastResult.activity,
      encouragement: lastResult.encouragement,
      taskDone: false,
      satisfaction: null
    };
    
    if (saveMood(entry)) {
      showToast('✨ Mood saved for today!');
      loadMoods();
      loadTodayMood();
    } else {
      showToast('❌ Could not save locally');
    }
  };

  const updateTaskStatus = (done) => {
    if (!todayMood) return;
    
    const patch = { taskDone: done };
    if (!done) patch.satisfaction = null;
    
    if (updateMood(todayMood.date, patch)) {
      loadMoods();
      loadTodayMood();
    }
  };

  const updateSatisfaction = (rating) => {
    if (!todayMood) return;
    
    if (updateMood(todayMood.date, { satisfaction: rating })) {
      loadMoods();
      loadTodayMood();
    }
  };

  const deleteMoodEntry = (date) => {
    if (confirm('Are you sure you want to delete this mood entry?')) {
      if (deleteMood(date)) {
        showToast('🗑️ Mood entry deleted');
        loadMoods();
        loadTodayMood();
      }
    }
  };

  const getEmotionEmoji = (emotion) => {
    const emojis = {
      happy: '��',
      sad: '��',
      anxious: '��',
      angry: '��',
      neutral: '��'
    };
    return emojis[emotion] || '😐';
  };

  const getFilteredMoods = () => {
    const now = new Date();
    const filterDate = new Date();
    
    switch (journalFilter) {
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setDate(now.getDate() - 30);
        break;
      default:
        return moods;
    }
    
    return moods.filter(mood => new Date(mood.date) >= filterDate);
  };

  const scrollToJournal = () => {
    setShowJournal(true);
    setTimeout(() => {
      document.getElementById('journal-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-cyan-100">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-lg z-50 animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-pink-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Feelink
          </h1>
          <nav className="flex items-center gap-4">
            <a href="#" className="text-gray-600 hover:text-pink-500 transition-colors">Home</a>
            <button 
              onClick={scrollToJournal}
              className="px-4 py-2 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-full hover:scale-105 transition-transform"
            >
              Journal
            </button>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Chat Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Chat with Feelink</h2>
          
          {/* Messages */}
          <div className="h-80 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block max-w-xs px-4 py-2 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-pink-400 to-purple-500 text-white' 
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  <pre className="whitespace-pre-wrap font-sans">{msg.text}</pre>
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-left">
                <div className="inline-block bg-white border border-gray-200 rounded-2xl px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full"></div>
                    <span className="text-gray-600">Bot is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="How are you feeling today?"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>

        {/* Set as Day Mood */}
        {lastResult && (
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-6 mb-6 border border-pink-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Set as Day Mood</h3>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{getEmotionEmoji(lastResult.emotion)}</span>
              <div>
                <div className="font-medium text-gray-800 capitalize">{lastResult.emotion}</div>
                <div className="text-sm text-gray-600">Confidence: {Math.round(lastResult.confidence * 100)}%</div>
              </div>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-700 mb-1"><strong>Activity:</strong> {lastResult.activity}</div>
              <div className="text-sm text-gray-700"><strong>Encouragement:</strong> {lastResult.encouragement}</div>
            </div>
            <button
              onClick={setAsDayMood}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              ✨ Set as Day Mood
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">Saves locally to your device</p>
          </div>
        )}

        {/* Today's Task */}
        {todayMood && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-cyan-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Today's Task</h3>
            <div className="flex items-center gap-3 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={todayMood.taskDone}
                  onChange={(e) => updateTaskStatus(e.target.checked)}
                  className="w-5 h-5 text-pink-500 rounded focus:ring-pink-400"
                />
                <span className="text-gray-800">{todayMood.activity}</span>
              </label>
            </div>
            
            {todayMood.taskDone && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">How did it make you feel?</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => updateSatisfaction(rating)}
                      className={`text-2xl transition-transform hover:scale-110 ${
                        todayMood.satisfaction >= rating ? 'text-pink-500' : 'text-gray-300'
                      }`}
                    >
                      ❤️
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Journal Section */}
        <div id="journal-section" className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Mood Journal</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setJournalFilter('week')}
                className={`px-3 py-1 rounded-full text-sm ${
                  journalFilter === 'week' 
                    ? 'bg-pink-500 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                Last 7 days
              </button>
              <button
                onClick={() => setJournalFilter('month')}
                className={`px-3 py-1 rounded-full text-sm ${
                  journalFilter === 'month' 
                    ? 'bg-pink-500 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                Last 30 days
              </button>
              <button
                onClick={() => setJournalFilter('all')}
                className={`px-3 py-1 rounded-full text-sm ${
                  journalFilter === 'all' 
                    ? 'bg-pink-500 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                All
              </button>
            </div>
          </div>

          {getFilteredMoods().length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">😊</div>
              <p className="text-lg mb-2">No mood entries yet</p>
              <p className="text-sm">Chat with the bot and click "Set as Day Mood" to get started!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {getFilteredMoods().map((mood, index) => (
                <div key={index} className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-4 border border-pink-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getEmotionEmoji(mood.emotion)}</span>
                        <span className="font-semibold text-gray-800 capitalize">{mood.emotion}</span>
                        <span className="text-sm text-gray-500">{mood.date}</span>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Activity:</strong> {mood.activity}
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Encouragement:</strong> {mood.encouragement}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className={`px-2 py-1 rounded-full ${
                          mood.taskDone ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {mood.taskDone ? '✅ Done' : '⬜ Pending'}
                        </span>
                        {mood.satisfaction && (
                          <span className="text-pink-500">
                            {'❤️'.repeat(mood.satisfaction)} ({mood.satisfaction}/5)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => updateMood(mood.date, { taskDone: !mood.taskDone })}
                        className="text-sm px-3 py-1 bg-white border border-gray-300 rounded-full hover:bg-gray-50"
                      >
                        Toggle Task
                      </button>
                      <button
                        onClick={() => deleteMoodEntry(mood.date)}
                        className="text-sm px-3 py-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
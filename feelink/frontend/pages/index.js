import { useState, useEffect } from 'react';
import { saveMood, getMoods, updateMood, getToday, deleteMood } from '../src/lib/storage';

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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 2;
  
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

  const getEmotionImage = (emotion) => {
    const images = {
      happy: '/decorations/happy.png',
      sad: '/decorations/sad.png',
      anxious: '/decorations/anxious.png',
      angry: '/decorations/angry.png',
      neutral: '/decorations/neutural.png' 
    };
    return images[emotion] || '/decorations/neutural.png';
  };

  const getMoodColor = (emotion) => {
    const colors = {
      happy: 'from-yellow-100 to-yellow-200 border-yellow-300',
      sad: 'from-blue-100 to-blue-200 border-blue-300',
      anxious: 'from-purple-100 to-purple-200 border-purple-300',
      angry: 'from-red-100 to-red-200 border-red-300',
      neutral: 'from-stone-100 to-stone-200 border-stone-300'
    };
    return colors[emotion] || 'from-gray-100 to-gray-200 border-gray-300';
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

  // Compute a paginated slice based on current filter and page
  const getTotalPages = () => {
    const total = getFilteredMoods().length;
    return Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  };

  const getPaginatedMoods = () => {
    const filtered = getFilteredMoods();
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  };

  // Reset/clamp page when filter or data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [journalFilter]);

  useEffect(() => {
    const totalPages = getTotalPages();
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [moods, journalFilter]);

  const scrollToJournal = () => {
    setShowJournal(true);
    setTimeout(() => {
      document.getElementById('journal-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-lg z-100 animate-pulse">
          {toast}
        </div>
      )}
        {/* Header */}
        <div className="text-center py-8 absolute top-4 left-1/2 right-0 translate-x-[-50%] z-10">
          <h1 className="hero-title font-bold text-pink-500 mb-4"  >
            FEELINK
          </h1>
          <p className="text-md md:text-lg text-gray-500 max-w-2xl mx-auto"  >
            Don't know how you feel? Don't know what to do? Come and chat with us!
          </p>
        </div>

      <div className="cloud-frame">

        <div className="mt-3 max-w-5xl mx-auto px-4 py-6">
           {/*decorations*/}  
          <img src="decorations/rainbow.png" alt="rainbow"
              class="decoration top-[-20px] left-[-30px] w-[240px]"></img>
          <img src="decorations/bow.png" alt="bow"
              class="decoration top-[30px] right-[120px] w-[120px]"></img>
          <img src="decorations/rainbow_pastel.png" alt="rainbow-pastel"
              class="decoration top-[-40px] right-[-30px] w-[240px] rotate-45 !z-69"></img>
          <img src="decorations/star.png" alt="star"
              class="decoration top-[550px] right-[20px] w-[150px]"></img>

          {/* Chat Section */}
          <div className="flex items-center gap-6 mb-6">
            {/* Purple Chatbot Character */}
            <div className="flex-shrink-0">
              <img 
                src="/decorations/ChatBot-purple.png" 
                alt="Purple ChatBot character" 
                className="w-55 h-55 object-contain u-transition-transform u-hover-scale-105"
              />
            </div>

            {/* Chat Box */}
            <div className="bg-white rounded-2xl p-6 flex-1 chatbox-speech-bubble">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center"  >
                CHAT WITH FEELINK
              </h2>         
              {/* Messages */}
              <div className="h-60 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                {messages.map((msg, i) => (
                  <div key={i} className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block max-w-xs px-4 py-2 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-pink-500 text-white' 
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}  >
                      <pre className="whitespace-pre-wrap font-sans"  >{msg.text}</pre>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="text-left">
                    <div className="inline-block bg-white border border-gray-200 rounded-2xl px-4 py-2">
                      <div className="flex items-center gap-2"  >
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
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                  
                />
                <button
                  onClick={sendMessage}
                  disabled={loading}
                  className="px-6 py-3 bg-pink-400 text-white rounded-md u-transition-transform u-hover-scale-105 disabled:opacity-50 disabled:cursor-not-allowed u-hover-bg-pink-500 u-hover-text-white"
                  style={{ fontFamily: 'Fredoka, sans-serif', background: '#EC4899', borderRadius: '8px' }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>

        {/* Set as Day Mood */}
        {lastResult && (
          <div className="relative mb-8 cloud-card">
            {/*decorations*/}  
            <img src="decorations/wink.png" alt="wink"
                class="decoration top-[100px] left-[-220px] w-[200px]"></img>
            <img src="decorations/sun.png" alt="sun"
                class="decoration top-[300px] right-[-250px] w-[250px]"></img>
          
            <h3 className="text-4xl font-bold text-pink-500 text-center mb-1"  >Set as Day Mood</h3>
            <div className="flex flex-row justify-center items-center mb-4">
              <img 
                src={getEmotionImage(lastResult.emotion)} 
                alt={lastResult.emotion}
                className="w-40 h-40 object-contain"
              />
            </div>
            <div className="flex flex-col items-center justify-center">
                <div className="font-medium text-gray-800 capitalize text-center text-4xl mb-2"  >
                  YOUR EMOTION: <strong>{lastResult.emotion}</strong>
                </div>
                <div className="text-lg text-gray-600 mb-2"  >
                    Confidence: {Math.round(lastResult.confidence * 100)}%
                </div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="mb-4">
                <div className="text-sm text-gray-700 mb-1"  ><strong>Activity:</strong> {lastResult.activity}</div>
                <div className="text-sm text-gray-700"  ><strong>Encouragement:</strong> {lastResult.encouragement}</div>
              </div>
              <button
                onClick={setAsDayMood}
                className="px-34 py-3 bg-white text-black border border-gray-700 rounded-md font-semibold shadow-lg u-transition-transform u-hover-scale-105 u-hover-bg-pink-500 u-hover-text-white"
              >
                Set as Day Mood
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-1"  >Saves locally to your device</p>
          </div>
        )}

        {/* Today's Task */}
        {todayMood && (
          <div className="bg-white rounded-md p-6 mb-6 border border-gray-400">

            <h3 className="text-4xl font-bold text-pink-500 mb-4" >Today's Task</h3>
            <div className="flex items-center gap-3 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={todayMood.taskDone}
                  onChange={(e) => updateTaskStatus(e.target.checked)}
                  className="w-5 h-5 text-pink-500 rounded focus:ring-pink-400"
                />
                <span className="text-gray-800"  >{todayMood.activity}</span>
              </label>
            </div>
            
            {todayMood.taskDone && (
              <div className="mt-8 flex flex-col items-center justify-center">
                <p className="text-sm text-gray-600 mb-5"  >How did it make you feel?</p>
                <div className="flex justify-center gap-2 ">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => updateSatisfaction(rating)}
                      className={'text-2xl u-transition-transform u-hover-scale-110 '}
                    >
                      <img src={'/decorations/star.png'} alt={`star ${rating}`} className="w-10 h-10 object-contain mr-8 cursor-pointer" />
                    </button>
                  ))}
                </div>
                <div className='w-full flex items-center justify-center gap-2 mt-2'>
                  <span className="text-sm text-gray-600"  >
                    Total rating: {todayMood.satisfaction || 0}/5
                  </span>
                </div>
              </div>
            )}
          </div>
        )}


        
        {/* Journal Section */}
        <div className="bg-white rounded-md border border-gray-400 p-6">
          {/*decorations*/}  
          <img src="decorations/wink.png" alt="wink"
              class="decoration bottom-[1px] left-[-20px] w-[250px]"></img>
          <img src="decorations/sun.png" alt="sun"
              class="decoration bottom-[30px] left-[350px] w-[100px] "></img>
          <img src="decorations/star.png" alt="star"
              class="decoration bottom-[20px] right-[0px] w-[220px]"></img>
          <img src="decorations/picture.png" alt="picture"
              class="decoration bottom-[30px] right-[220px] w-[80px] rotate-15"></img>
          
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-4xl font-bold text-pink-500"  >Mood Journal</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setJournalFilter('week')}
                className={`px-3 py-1 rounded-sm border border-gray-600 text-sm cursor-pointer ${
                  journalFilter === 'week' 
                    ? 'bg-pink-500 text-white border border-gray-600' 
                    : 'bg-white text-gray-600'
                }`}
                 
              >
                Last 7 days
              </button>
              <button
                onClick={() => setJournalFilter('month')}
                className={`px-3 py-1 rounded-sm border border-gray-600 text-sm cursor-pointer ${
                  journalFilter === 'month' 
                    ? 'bg-pink-500 text-white border border-gray-600' 
                    : 'bg-white text-gray-600'
                }`}
                 
              >
                Last 30 days
              </button>
              <button
                onClick={() => setJournalFilter('all')}
                className={`px-3 py-1 rounded-sm border border-gray-600 text-sm cursor-pointer ${
                  journalFilter === 'all' 
                    ? 'bg-pink-500 text-white border border-gray-600' 
                    : 'bg-white text-gray-600'
                }`}
                 
              >
                All
              </button>
            </div>
          </div>

          {getFilteredMoods().length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-2 text-pink-500">
                <a className='fas fa-smile'></a>
              </div>
              <p className="text-lg mb-2"  >No mood entries yet</p>
              <p className="text-sm"  >Chat with the bot and click "Set as Day Mood" to get started!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {getPaginatedMoods().map((mood, index) => (
                <div key={index} className={`bg-gradient-to-r ${getMoodColor(mood.emotion)} rounded-lg p-6 border shadow-sm`}>
                  <div className="flex items-center gap-4">
                    {/* Left side - Emotion image and date */}
                    <div className="flex flex-col items-center mr-4">
                      <img 
                        src={getEmotionImage(mood.emotion)} 
                        alt={mood.emotion}
                        className="w-16 h-16 object-contain mb-2"
                      />
                      <span className="text-xs text-gray-600">{mood.date}</span>
                    </div>
                    
                    {/* Middle - Content */}
                    <div className="flex-1">
                      <div className="mb-2">
                        <span className="font-bold text-gray-800 uppercase text-sm">Emotion: {mood.emotion}</span>
                      </div>
                      <div className="text-sm text-gray-700 mb-1">
                        <strong>Activity:</strong> {mood.activity}
                      </div>
                      <div className="text-sm text-gray-700">
                        <strong>Encouragement:</strong> {mood.encouragement}
                      </div>
                    </div>
                    
                    {/* Right side - Action buttons */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => deleteMoodEntry(mood.date)}
                        className="text-gray-600 u-hover-text-red-400 cursor-pointer p-1"
                        title="Delete"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                      
                      <div className="flex gap-2">
                        {mood.satisfaction && (
                          <span className="px-2 py-1 bg-yellow-500 text-white rounded-sm text-xs">
                            Rate: ({mood.satisfaction}/5) ★
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded-sm text-xs ${
                          mood.taskDone ? 'bg-green-500/50 text-white' : 'bg-white text-gray-600'
                        }`}>
                          {mood.taskDone ? (
                            <>
                              <i className="fas fa-check mr-1"></i>Done
                            </>
                          ) : (
                            <>
                              <i className="fas fa-clock mr-1"></i>Pending
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {/* Pagination controls */}
              <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`w-8 h-8 flex items-center justify-center text-lg ${currentPage === 1 ? 'text-gray-300' : 'text-gray-700 u-hover-text-gray-900 cursor-pointer'}`}
                    aria-label="Previous page"
                  >
                  ‹
                </button>
                {Array.from({ length: getTotalPages() }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-full border border-gray-400 flex items-center justify-center text-sm transition-colors ${
                      currentPage === page ? 'bg-gray-200 text-gray-900' : 'bg-white text-gray-700 u-hover-bg-gray-100'
                    }`}
                    aria-current={currentPage === page ? 'page' : undefined}
                  >
                    {page}
                  </button>
                ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(getTotalPages(), p + 1))}
                    disabled={currentPage === getTotalPages()}
                    className={`w-8 h-8 flex items-center justify-center text-lg ${currentPage === getTotalPages() ? 'text-gray-300' : 'text-gray-700 u-hover-text-gray-900 cursor-pointer'}`}
                    aria-label="Next page"
                  >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
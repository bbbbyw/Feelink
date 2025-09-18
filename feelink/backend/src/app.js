const Sentiment = require('sentiment');
const AWS = require('aws-sdk');
const crypto = require('crypto');

const sentiment = new Sentiment();
const db = new AWS.DynamoDB.DocumentClient();

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'FeelinkSessions';
const ACTIVITIES_TABLE = process.env.ACTIVITIES_TABLE || '';
const ENABLE_OPENAI = process.env.ENABLE_OPENAI === 'true';

const KEYWORDS = {
  en: {
    happy: ['happy','joy','glad','excited','great','pleased'],
    sad: ['sad','lonely','depressed','unhappy','miserable','down'],
    anxious: ['anxiety','anxious','worried','nervous','stressed','panic'],
    angry: ['angry','mad','furious','annoyed','irate','frustrat']
  },
  th: {
    happy: ['มีความสุข','ดีใจ','สุข','ยินดี','สนุก'],
    sad: ['เศร้า','เสียใจ','หดหู่','เหงา'],
    anxious: ['กังวล','เครียด','หวั่น','ห่วง'],
    angry: ['โกรธ','หงุดหงิด','โมโห']
  }
};

const FALLBACK_BANK = {
  happy: { activity: 'Share a happy moment with a friend or write it down.', encouragement: 'Keep shining ✨' },
  sad: { activity: 'Try a short walk or listen to a comforting song.', encouragement: "This too shall pass — you're not alone." },
  anxious: { activity: 'Try 3 deep breaths and a 2-minute grounding exercise.', encouragement: "Breathe. You’ve got this." },
  angry: { activity: 'Step away for 5 minutes and breathe deeply.', encouragement: 'It’s okay to feel this. Take a pause.' },
  neutral: { activity: 'Write down one small win today.', encouragement: 'Small steps add up.' }
};

const makeResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
  },
  body: JSON.stringify(body)
});

function detectLanguage(text){
  try {
    // Simple Thai script detection (U+0E00–U+0E7F)
    if (/[\u0E00-\u0E7F]/.test(text)) return 'th';
    return 'en';
  } catch {
    return 'en';
  }
}

function extractKeywordVotes(text, lang) {
  const lower = text.toLowerCase();
  const bank = KEYWORDS[lang] || KEYWORDS.en;
  const votes = { happy:0, sad:0, anxious:0, angry:0 };
  for (const emo of Object.keys(bank)){
    for (const kw of bank[emo]){
      if (lower.includes(kw)) votes[emo] += 1;
    }
  }
  return votes;
}

function pickEmotionFromEnsemble(sentScore, votes){
  const normalized = Math.max(-5, Math.min(5, sentScore));
  const sentProb = (normalized + 5) / 10;
  const kwTop = Object.entries(votes).sort((a,b)=>b[1]-a[1]);
  let chosen = 'neutral';
  let confidence = 0.5;

  if (kwTop[0][1] >= 2) {
    chosen = kwTop[0][0];
    confidence = 0.6 + Math.min(0.3, kwTop[0][1]*0.05);
  } else {
    if (sentProb >= 0.7) { chosen = 'happy'; confidence = 0.7; }
    else if (sentProb <= 0.3) { chosen = 'sad'; confidence = 0.7; }
    else chosen = 'neutral';
  }

  if (votes.anxious > 0 && votes.anxious >= votes[chosen]) { chosen = 'anxious'; confidence = Math.max(confidence, 0.65); }
  if (votes.angry > 0 && votes.angry >= votes[chosen]) { chosen = 'angry'; confidence = Math.max(confidence, 0.65); }

  confidence = Math.max(0.45, Math.min(0.98, confidence));
  return { chosen, confidence };
}

async function getActivityFromDynamo(emotion){
  if (!ACTIVITIES_TABLE) return FALLBACK_BANK[emotion] || FALLBACK_BANK['neutral'];
  const params = {
    TableName: ACTIVITIES_TABLE,
    FilterExpression: '#e = :emo',
    ExpressionAttributeNames: { '#e': 'emotion' },
    ExpressionAttributeValues: { ':emo': emotion },
    Limit: 10
  };
  try {
    const res = await db.scan(params).promise();
    const items = res.Items || [];
    if (items.length === 0) return FALLBACK_BANK[emotion] || FALLBACK_BANK['neutral'];
    const pick = items[Math.floor(Math.random()*items.length)];
    return { activity: pick.activity || FALLBACK_BANK[emotion].activity, encouragement: pick.encouragement || FALLBACK_BANK[emotion].encouragement };
  } catch (err) {
    console.warn('Activity lookup error', err);
    return FALLBACK_BANK[emotion] || FALLBACK_BANK['neutral'];
  }
}

async function storeSession(payload){
  try {
    await db.put({ TableName: SESSIONS_TABLE, Item: payload }).promise();
  } catch (err) {
    console.warn('DynamoDB put error', err);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return makeResponse(204, {});
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const text = (body.text || '').toString().trim();
    if (!text) return makeResponse(400, { error: 'No text provided' });

    const lang = detectLanguage(text);
    const sentRes = sentiment.analyze(text);
    const sentScore = sentRes.score;
    const votes = extractKeywordVotes(text, lang);
    const { chosen, confidence } = pickEmotionFromEnsemble(sentScore, votes);
    const chosenActivity = await getActivityFromDynamo(chosen);

    const rawUser = body.userId || event.requestContext?.identity?.sourceIp || 'anon';
    const userHash = crypto.createHash('sha256').update(rawUser).digest('hex').slice(0,16);
    const sessionItem = {
      sessionId: String(Date.now()),
      userHash,
      timestamp: new Date().toISOString(),
      text,
      emotion: chosen,
      confidence,
      score: sentScore,
      lang
    };
    storeSession(sessionItem).catch(()=>{});

    const response = {
      emotion: chosen,
      confidence,
      activity: chosenActivity.activity,
      encouragement: chosenActivity.encouragement || chosenActivity.encourage,
      details: {
        sentimentScore: sentScore,
        keywordVotes: votes,
        detectedLanguage: lang,
        source: ENABLE_OPENAI ? 'openai-fallback' : 'local-ensemble'
      }
    };
    return makeResponse(200, response);
  } catch (err) {
    console.error('Handler error', err);
    return makeResponse(500, { error: 'Internal server error' });
  }
}; 
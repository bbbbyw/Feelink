const Sentiment = require('sentiment');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const axios = require('axios');

const sentiment = new Sentiment();
const db = new AWS.DynamoDB.DocumentClient();

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'FeelinkSessions';
const ACTIVITIES_TABLE = process.env.ACTIVITIES_TABLE || '';
const ENABLE_OPENAI = process.env.ENABLE_OPENAI === 'true';
const USAGE_TABLE = process.env.USAGE_TABLE || 'FeelinkUsage';
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY || '';
const ENABLE_HF = process.env.ENABLE_HF === 'true';
const HF_MONTHLY_LIMIT = Number(process.env.HF_MONTHLY_LIMIT || '500');

// Hugging Face emotion models (free tier)
const HF_MODELS = {
  en: 'cardiffnlp/twitter-roberta-base-emotion',
  multilingual: 'j-hartmann/emotion-english-distilroberta-base'
};

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

// Rate limit helpers (monthly counter in DynamoDB)
function getMonthKey(date = new Date()){
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function checkAndIncrementMonthlyQuota(){
  if (!USAGE_TABLE) return { allowed: true };
  const pk = `hf-usage-${getMonthKey()}`;
  const params = {
    TableName: USAGE_TABLE,
    Key: { pk },
    UpdateExpression: 'ADD #count :inc',
    ExpressionAttributeNames: { '#count': 'count' },
    ExpressionAttributeValues: { ':inc': 1 },
    ReturnValues: 'UPDATED_NEW'
  };
  try {
    const res = await db.update(params).promise();
    const current = res.Attributes?.count || 0;
    if (current > HF_MONTHLY_LIMIT) return { allowed: false, current };
    return { allowed: true, current };
  } catch (err) {
    console.warn('Quota update error', err);
    return { allowed: true, error: 'quota-update-failed' };
  }
}

// Hugging Face emotion detection
async function analyzeEmotionWithHF(text, retryCount = 0){
  if (!ENABLE_HF || !HUGGING_FACE_API_KEY) return null;

  const quota = await checkAndIncrementMonthlyQuota();
  if (!quota.allowed) return null;

  const model = HF_MODELS.multilingual;
  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      { inputs: text, options: { wait_for_model: true, use_cache: true } },
      { headers: { Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,'Content-Type': 'application/json' }, timeout: 10000 }
    );
    if (response.data && Array.isArray(response.data) && response.data.length > 0){
      const emotions = response.data[0].sort((a,b)=>b.score - a.score);
      return { topEmotion: emotions[0], allEmotions: emotions, confidence: emotions[0].score, source: 'huggingface' };
    }
    return null;
  } catch (error) {
    if (error.response?.data?.error?.includes('loading') && retryCount === 0){
      await new Promise(r => setTimeout(r, 20000));
      return analyzeEmotionWithHF(text, retryCount + 1);
    }
    return null;
  }
}

function mapHFEmotionToCategories(hfResult){
  if (!hfResult || !hfResult.topEmotion) return null;
  const emotionMap = {
    joy: 'happy', happiness: 'happy', optimism: 'happy', love: 'happy',
    sadness: 'sad', grief: 'sad', disappointment: 'sad',
    anger: 'angry', annoyance: 'angry', rage: 'angry', disgust: 'angry',
    fear: 'anxious', nervousness: 'anxious', anxiety: 'anxious', worry: 'anxious',
    surprise: 'neutral', neutral: 'neutral'
  };
  const hfEmotion = hfResult.topEmotion.label.toLowerCase();
  const mappedEmotion = emotionMap[hfEmotion] || 'neutral';
  return { emotion: mappedEmotion, confidence: hfResult.topEmotion.score, originalEmotion: hfEmotion, allEmotions: hfResult.allEmotions };
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

async function detectEmotionEnsemble(text, lang){
  const hfResult = await analyzeEmotionWithHF(text);
  if (hfResult && hfResult.confidence > 0.7){
    const mapped = mapHFEmotionToCategories(hfResult);
    return {
      emotion: mapped.emotion,
      confidence: Math.min(0.95, mapped.confidence + 0.1),
      method: 'huggingface',
      details: { originalEmotion: mapped.originalEmotion, hfConfidence: hfResult.confidence, allEmotions: mapped.allEmotions }
    };
  }

  const sentRes = sentiment.analyze(text);
  const sentScore = sentRes.score;
  const votes = extractKeywordVotes(text, lang);
  const { chosen, confidence } = pickEmotionFromEnsemble(sentScore, votes);

  let finalConfidence = confidence;
  if (hfResult){
    const hfMapped = mapHFEmotionToCategories(hfResult);
    if (hfMapped && hfMapped.emotion === chosen){
      finalConfidence = Math.min(0.9, confidence + 0.15);
    }
  }

  return {
    emotion: chosen,
    confidence: finalConfidence,
    method: hfResult ? 'ensemble-with-hf' : 'ensemble-only',
    details: { sentimentScore: sentScore, keywordVotes: votes, hfResult: hfResult ? mapHFEmotionToCategories(hfResult) : null }
  };
}

async function getActivityFromDynamo(emotion){
  if (!ACTIVITIES_TABLE) {
    const fb = FALLBACK_BANK[emotion] || FALLBACK_BANK['neutral'];
    return { activity: fb.activity, encouragement: fb.encouragement, _source: 'fallback', _matchedCount: 0 };
  }
  const params = {
    TableName: ACTIVITIES_TABLE,
    FilterExpression: '#e = :emo',
    ExpressionAttributeNames: { '#e': 'emotion' },
    ExpressionAttributeValues: { ':emo': emotion }
  };
  try {
    const res = await db.scan(params).promise();
    const items = res.Items || [];
    if (items.length === 0) {
      const fb = FALLBACK_BANK[emotion] || FALLBACK_BANK['neutral'];
      return { activity: fb.activity, encouragement: fb.encouragement, _source: 'fallback', _matchedCount: 0 };
    }
    const pick = items[Math.floor(Math.random()*items.length)];
    return {
      activity: pick.activity || FALLBACK_BANK[emotion].activity,
      encouragement: pick.encouragement || FALLBACK_BANK[emotion].encouragement,
      _source: 'dynamodb',
      _matchedCount: items.length
    };
  } catch (err) {
    console.warn('Activity lookup error', err);
    const fb = FALLBACK_BANK[emotion] || FALLBACK_BANK['neutral'];
    return { activity: fb.activity, encouragement: fb.encouragement, _source: 'fallback-error', _matchedCount: 0 };
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
    const emotionResult = await detectEmotionEnsemble(text, lang);
    const chosenActivity = await getActivityFromDynamo(emotionResult.emotion);

    const rawUser = body.userId || event.requestContext?.identity?.sourceIp || 'anon';
    const userHash = crypto.createHash('sha256').update(rawUser).digest('hex').slice(0,16);
    const sessionItem = {
      sessionId: String(Date.now()),
      userHash,
      timestamp: new Date().toISOString(),
      text,
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      method: emotionResult.method,
      lang,
      details: emotionResult.details
    };
    storeSession(sessionItem).catch(()=>{});

    const response = {
      emotion: emotionResult.emotion,
      confidence: emotionResult.confidence,
      activity: chosenActivity.activity,
      encouragement: chosenActivity.encouragement || chosenActivity.encourage,
      details: {
        detectedLanguage: lang,
        analysisMethod: emotionResult.method,
        ...emotionResult.details,
        activitiesSource: chosenActivity._source,
        activitiesMatchedCount: chosenActivity._matchedCount,
        activitiesTable: ACTIVITIES_TABLE || 'fallback'
      }
    };
    return makeResponse(200, response);
  } catch (err) {
    console.error('Handler error', err);
    return makeResponse(500, { error: 'Internal server error' });
  }
}; 
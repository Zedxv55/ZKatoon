import type { PronunciationEntry, VoiceEmotion } from '../types/cartoon';

const THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

const DEFAULT_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/พ\.ศ\./g, 'พุทธศักราช '],
  [/ค\.ศ\./g, 'คริสต์ศักราช '],
  [/กทม\./g, 'กรุงเทพมหานคร'],
  [/น\.(?=\s|$)/g, 'นาฬิกา'],
  [/ชม\./g, 'ชั่วโมง'],
  [/นาที\./g, 'นาที'],
  [/วินาที\./g, 'วินาที'],
  [/ฯลฯ/g, 'และอื่นๆ'],
  [/จ\.([ก-ฮ])/g, 'จังหวัด $1'],
  [/อ\.([ก-ฮ])/g, 'อำเภอ $1'],
  [/ต\.([ก-ฮ])/g, 'ตำบล $1'],
  [/\bAI\b/gi, 'เอไอ'],
  [/\b3D\b/gi, 'ทรีดี'],
  [/\b2D\b/gi, 'ทูดี'],
  [/\bTTS\b/gi, 'ทีทีเอส'],
  [/\bMP4\b/gi, 'เอ็มพีโฟร์'],
  [/\bFPS\b/gi, 'เฟรมต่อวินาที'],
  [/\bAPI\b/gi, 'เอพีไอ'],
  [/\bLINE\b/gi, 'ไลน์'],
  [/\bTikTok\b/gi, 'ติ๊กต๊อก'],
  [/\bYouTube\b/gi, 'ยูทูบ'],
];

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

function normalizeThaiDigitsToArabic(input: string): string {
  const thaiZero = '๐'.charCodeAt(0);
  return input.replace(/[๐-๙]/g, (ch) => String(ch.charCodeAt(0) - thaiZero));
}

export function integerToThaiWords(numInput: number): string {
  if (!Number.isFinite(numInput)) return '';
  if (numInput < 0) return `ลบ${integerToThaiWords(Math.abs(numInput))}`;
  const n = Math.floor(numInput);
  if (n === 0) return THAI_DIGITS[0];

  if (n >= 1_000_000) {
    const millions = Math.floor(n / 1_000_000);
    const rem = n % 1_000_000;
    return `${integerToThaiWords(millions)}ล้าน${rem > 0 ? integerToThaiWords(rem) : ''}`;
  }

  const str = String(n);
  let out = '';
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(str[i]);
    const pos = len - 1 - i;
    if (digit === 0) continue;
    if (pos === 0 && digit === 1 && len > 1) {
      out += 'เอ็ด';
    } else if (pos === 1 && digit === 2) {
      out += 'ยี่สิบ';
    } else if (pos === 1 && digit === 1) {
      out += 'สิบ';
    } else {
      out += `${THAI_DIGITS[digit]}${THAI_PLACES[pos]}`;
    }
  }
  return out;
}

export function numberStringToThaiWords(raw: string): string {
  const clean = normalizeThaiDigitsToArabic(raw).replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return raw;
  const [intPart, decPart] = clean.split('.');
  const intNum = Number(intPart);
  const intWords = integerToThaiWords(intNum);
  if (!decPart) return intWords;
  const decWords = decPart
    .split('')
    .map((d) => THAI_DIGITS[Number(d)] || d)
    .join('');
  return `${intWords}จุด${decWords}`;
}

export function formatTimeToThaiSpeech(hourStr: string, minStr: string): string {
  const h = Number(normalizeThaiDigitsToArabic(hourStr));
  const m = Number(normalizeThaiDigitsToArabic(minStr));
  if (Number.isNaN(h) || Number.isNaN(m) || h > 24 || m > 59) {
    return `${hourStr}:${minStr}`;
  }
  const hourWord = `${integerToThaiWords(h)}นาฬิกา`;
  if (m === 0) return hourWord;
  return `${hourWord}${integerToThaiWords(m)}นาที`;
}

export function formatDateToThaiSpeech(dayStr: string, monthStr: string, yearStr: string): string {
  const d = Number(normalizeThaiDigitsToArabic(dayStr));
  const m = Number(normalizeThaiDigitsToArabic(monthStr));
  const y = Number(normalizeThaiDigitsToArabic(yearStr));
  if (d < 1 || d > 31 || m < 1 || m > 12) {
    return `${dayStr}/${monthStr}/${yearStr}`;
  }
  const monthName = THAI_MONTHS[m - 1];
  return `วันที่ ${integerToThaiWords(d)} ${monthName} ${integerToThaiWords(y)}`;
}

export function applyPronunciationDictionary(
  text: string,
  dictionary: PronunciationEntry[]
): string {
  let out = text;
  const sorted = [...dictionary]
    .filter((entry) => entry.word.trim() && entry.reading.trim())
    .sort((a, b) => b.word.length - a.word.length);

  for (const entry of sorted) {
    const escaped = entry.word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), entry.reading.trim());
  }
  return out;
}

export interface ThaiSpeechPrepareOptions {
  dictionary?: PronunciationEntry[];
  convertNumbers?: boolean;
  convertDatesAndTimes?: boolean;
  expandAbbreviations?: boolean;
  addBreathPauses?: boolean;
}

export function prepareThaiSpeechText(
  rawText: string,
  options: ThaiSpeechPrepareOptions = {}
): string {
  const {
    dictionary = [],
    convertNumbers = true,
    convertDatesAndTimes = true,
    expandAbbreviations = true,
    addBreathPauses = true,
  } = options;

  let text = String(rawText || '').trim();
  if (!text) return '';

  // 1. User Pronunciation Dictionary first (allows overriding custom proper nouns)
  text = applyPronunciationDictionary(text, dictionary);

  // 2. Normalize Thai digits so date/time/number rules match uniformly
  text = normalizeThaiDigitsToArabic(text);

  // 3. Dates & Times
  if (convertDatesAndTimes) {
    text = text.replace(
      /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g,
      (_m, d, mo, y) => formatDateToThaiSpeech(d, mo, y)
    );
    text = text.replace(
      /\b(\d{1,2}):(\d{2})(?:\s*น\.?)?/g,
      (_m, h, mi) => formatTimeToThaiSpeech(h, mi)
    );
  }

  // 4. Abbreviations & English transliterations
  if (expandAbbreviations) {
    for (const [pattern, replacement] of DEFAULT_ABBREVIATIONS) {
      text = text.replace(pattern, replacement);
    }
  }

  // 5. Standalone numbers & decimals (e.g. 8 เดือน, 1,250, 3.5)
  if (convertNumbers) {
    text = text.replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g, (numMatch) =>
      numberStringToThaiWords(numMatch)
    );
  }

  // 6. Punctuation & pacing for Thai TTS
  if (addBreathPauses) {
    text = text
      .replace(/,/g, ' , ')
      .replace(/\./g, ' . ')
      .replace(/!/g, ' ! ')
      .replace(/\?/g, ' ? ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  return text;
}

export function splitThaiDialogueSentences(text: string): string[] {
  return String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const AZURE_STYLE_MAP: Partial<Record<VoiceEmotion, string>> = {
  energetic: 'cheerful',
  excited: 'excited',
  sad: 'sad',
  whisper: 'whispering',
  warm: 'friendly',
  tense: 'terrified',
};

export function buildAzureSsml(params: {
  text: string;
  voiceId: string;
  emotion?: VoiceEmotion;
  speed?: number;
  pitch?: number;
}): string {
  const ratePct = Math.round(((params.speed ?? 1) - 1) * 100);
  const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;
  const pitchSt = params.pitch ?? 0;
  const pitchStr = `${pitchSt >= 0 ? '+' : ''}${pitchSt}st`;
  const style = params.emotion ? AZURE_STYLE_MAP[params.emotion] : undefined;

  const escaped = escapeXml(params.text).replace(/\s*,\s*/g, '<break time="220ms"/> ');
  const inner = `<prosody rate="${rateStr}" pitch="${pitchStr}">${escaped}</prosody>`;
  const expressWrapped = style
    ? `<mstts:express-as style="${style}">${inner}</mstts:express-as>`
    : inner;

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="th-TH"><voice name="${escapeXml(params.voiceId)}">${expressWrapped}</voice></speak>`;
}

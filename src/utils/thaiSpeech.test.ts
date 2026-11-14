import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAzureSsml,
  integerToThaiWords,
  numberStringToThaiWords,
  prepareThaiSpeechText,
  splitThaiDialogueSentences,
} from './thaiSpeech';

test('prepareThaiSpeechText applies custom pronunciation dictionary and keeps Thai numbers readable', () => {
  const dict = [
    { id: '1', word: 'ZKatoon', reading: 'ซีคาตูน' },
    { id: '2', word: 'กทม.', reading: 'กรุงเทพมหานคร' },
  ];
  const out = prepareThaiSpeechText(
    'เวลา 06:30 น. ใน ZKatoon ที่ กทม. มีคน 125 คน.',
    { dictionary: dict }
  );
  assert.ok(out.includes('ซีคาตูน'));
  assert.ok(out.includes('กรุงเทพมหานคร'));
  assert.ok(out.includes('หกนาฬิกาสามสิบนาที'));
  assert.ok(out.includes('หนึ่งร้อยยี่สิบห้า'));
});

test('integerToThaiWords and numberStringToThaiWords translate integers and decimals cleanly', () => {
  assert.equal(integerToThaiWords(15), 'สิบห้า');
  assert.equal(integerToThaiWords(101), 'หนึ่งร้อยเอ็ด');
  assert.equal(integerToThaiWords(2025), 'สองพันยี่สิบห้า');
  assert.equal(numberStringToThaiWords('3.5'), 'สามจุดห้า');
});

test('splitThaiDialogueSentences segments multi-sentence Thai narration cleanly', () => {
  const text = 'ประโยคแรกมาแล้ว. ประโยคที่สองต่อทันที! จบหรือยัง?';
  const chunks = splitThaiDialogueSentences(text);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0], 'ประโยคแรกมาแล้ว.');
});

test('buildAzureSsml escapes XML special chars and wraps voice + prosody rate', () => {
  const ssml = buildAzureSsml({
    text: 'สวัสดี <ZKatoon> & เพื่อน, พักหายใจ.',
    voiceId: 'th-TH-PremwadeeNeural',
    emotion: 'warm',
    speed: 1.15,
  });
  assert.ok(ssml.includes('&lt;ZKatoon&gt;'));
  assert.ok(ssml.includes('&amp;'));
  assert.ok(ssml.includes('th-TH-PremwadeeNeural'));
  assert.ok(ssml.includes('<prosody'));
  assert.ok(ssml.includes('<break time="220ms"/>'));
});

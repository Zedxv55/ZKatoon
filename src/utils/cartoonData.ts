import type {
  CartoonEnding,
  CartoonGenre,
  CartoonLength,
  CartoonMode,
  CartoonProject,
  CartoonStyleKey,
  StudioSettings,
  VoiceName,
} from '../types/cartoon';

export interface StylePalette {
  key: CartoonStyleKey;
  n: string;
  tag: string;
  t: string;
  b: string;
  g: string;
  sk: string;
  ac: string;
  hi: string;
}

export const STYLES: Record<CartoonStyleKey, StylePalette> = {
  bright: {
    key: 'bright',
    n: 'สว่างสดใส',
    tag: 'Pop Lab',
    t: '#6ee7ff',
    b: '#fff2b0',
    g: '#ffd166',
    sk: '#2a9d8f',
    ac: '#ff5c7a',
    hi: '#ffe14d',
  },
  night: {
    key: 'night',
    n: 'ห้องกลางคืนอบอุ่น',
    tag: 'Warm Night',
    t: '#1b1340',
    b: '#5b3fb0',
    g: '#2a1d57',
    sk: '#140d33',
    ac: '#8b5cf6',
    hi: '#ffc98a',
  },
  cinema: {
    key: 'cinema',
    n: 'สืบสวนโทนภาพยนตร์',
    tag: 'Noir Film',
    t: '#ff9a6b',
    b: '#3b3a6e',
    g: '#23233f',
    sk: '#15152b',
    ac: '#2f4b7c',
    hi: '#ffd23f',
  },
  shrine: {
    key: 'shrine',
    n: 'ศาลเจ้า / สยองความเชื่อ',
    tag: 'Folklore',
    t: '#0b0604',
    b: '#4a1d08',
    g: '#1a0d06',
    sk: '#080402',
    ac: '#b91c1c',
    hi: '#ffb347',
  },
  street: {
    key: 'street',
    n: 'ย่านร้านค้าไทย',
    tag: 'Thai Street',
    t: '#8fd3ff',
    b: '#fff0d4',
    g: '#e9c46a',
    sk: '#6aa6c9',
    ac: '#e76f51',
    hi: '#ffe14d',
  },
  cute: {
    key: 'cute',
    n: 'การ์ตูนน่ารัก',
    tag: 'Pastel Pop',
    t: '#ffd1f0',
    b: '#c9f1ff',
    g: '#b6f2c3',
    sk: '#f4a6d7',
    ac: '#ff6fb5',
    hi: '#ffe14d',
  },
  dark: {
    key: 'dark',
    n: 'Dark Cinematic',
    tag: 'Deep Noir',
    t: '#06060a',
    b: '#1d1a2e',
    g: '#0d0c16',
    sk: '#0a0912',
    ac: '#475569',
    hi: '#fde047',
  },
  clay: {
    key: 'clay',
    n: 'ลุคดินน้ำมัน 2.5D',
    tag: 'Stop Motion',
    t: '#cdeccf',
    b: '#fbe3b8',
    g: '#e6b98a',
    sk: '#a8d5ba',
    ac: '#e07a5f',
    hi: '#ffd166',
  },
};

export const MODE_OPTIONS: Array<{ value: CartoonMode; label: string; desc: string }> = [
  { value: 'story', label: 'เล่าเรื่อง', desc: 'พล็อตมีต้น-กลาง-จบ น่าติดตาม' },
  { value: 'explain', label: 'ให้ความรู้', desc: 'ย่อยเรื่องยากเป็นภาพและตัวเลข' },
  { value: 'mix', label: 'ผสมผสาน', desc: 'เดินเรื่องด้วยตัวละครพร้อมสาระ' },
];

export const GENRE_OPTIONS: Array<{ value: CartoonGenre; label: string }> = [
  { value: 'ตลก', label: 'ตลก' },
  { value: 'ลึกลับสยองขวัญ', label: 'ลึกลับสยองขวัญ' },
  { value: 'ดราม่าซึ้ง', label: 'ดราม่าซึ้ง' },
  { value: 'สืบสวนตื่นเต้น', label: 'สืบสวนตื่นเต้น' },
  { value: 'ให้ความรู้', label: 'ให้ความรู้' },
];

export const LENGTH_OPTIONS: Array<{ value: CartoonLength; label: string; scenes: number }> = [
  { value: 30, label: '30 วินาที', scenes: 6 },
  { value: 60, label: '60 วินาที', scenes: 9 },
  { value: 90, label: '90 วินาที', scenes: 13 },
];

export const ENDING_OPTIONS: Array<{ value: CartoonEnding; label: string }> = [
  { value: 'twist', label: 'หักมุม' },
  { value: 'summary', label: 'สรุปข้อคิด' },
  { value: 'next', label: 'ตอนต่อไป' },
  { value: 'cta', label: 'ชวนคอมเมนต์' },
];

export const VOICE_PRESETS: Array<{ id: VoiceName; name: string; desc: string }> = [
  { id: 'Kore', name: 'Kore — นุ่มนวล ชัดถ้อยชัดคำ', desc: 'เหมาะกับสารคดี เล่าเรื่องทั่วไป และให้ความรู้' },
  { id: 'Puck', name: 'Puck — สดใส มีพลัง', desc: 'เหมาะกับเรื่องตลก คลิปไวรัล และจังหวะเร็ว' },
  { id: 'Charon', name: 'Charon — ทุ้มลึก น่าค้นหา', desc: 'เหมาะกับเรื่องลึกลับ สยองขวัญ และสืบสวน' },
  { id: 'Fenrir', name: 'Fenrir — จริงจัง หนักแน่น', desc: 'เหมาะกับดราม่า ข้อคิด และข่าวเจาะลึก' },
  { id: 'Zephyr', name: 'Zephyr — อ่อนโยน เป็นกันเอง', desc: 'เหมาะกับการ์ตูนน่ารัก และเล่าเรื่องอบอุ่น' },
];

export const DEFAULT_SETTINGS: StudioSettings = {
  voiceName: 'Kore',
  voiceStyle: 'พูดภาษาไทยเป็นธรรมชาติ มีจังหวะหยุดเว้นวรรคชัดเจน น้ำเสียงน่าฟังเหมือนนักเล่าเรื่องมืออาชีพ',
  defaultRes: '720',
  subtitleScale: 'normal',
};

export interface StarterTemplate {
  id: string;
  label: string;
  topic: string;
  facts: string;
  mode: CartoonMode;
  genre: CartoonGenre;
  len: CartoonLength;
  style: CartoonStyleKey;
  end: CartoonEnding;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'sleep-3am',
    label: 'ทำไมตื่นตี 3 แล้วนอนต่อไม่ได้',
    topic: 'ทำไมคนถึงชอบตื่นมาตอนตีสามแล้วนอนไม่หลับอีกเลย',
    facts: 'วงจรการนอน 1 รอบใช้เวลา 90 นาที, ฮอร์โมนคอร์ติซอลเริ่มไต่ระดับช่วงตี 3-4',
    mode: 'explain',
    genre: 'ให้ความรู้',
    len: 30,
    style: 'night',
    end: 'summary',
  },
  {
    id: 'cat-corner',
    label: 'ทำไมแมวจ้องมุมห้องว่างๆ',
    topic: 'ทำไมแมวถึงชอบนั่งจ้องมุมห้องว่างๆ ตอนกลางคืน',
    facts: 'แมวได้ยินเสียงความถี่สูงถึง 64 kHz และรับแสงในที่มืดได้ดีกว่ามนุษย์ 6 เท่า',
    mode: 'mix',
    genre: 'ลึกลับสยองขวัญ',
    len: 30,
    style: 'shrine',
    end: 'twist',
  },
  {
    id: 'coffee-nap',
    label: 'สูตรลับ Coffee Nap 20 นาที',
    topic: 'ดื่มกาแฟแล้วงีบทันที 20 นาที ตื่นมาสดชื่นกว่าเดิมจริงไหม',
    facts: 'คาเฟอีนใช้เวลาดูดซึมเข้าสมองประมาณ 20 นาที พอดีกับช่วงงีบสั้นก่อนหลับลึก',
    mode: 'explain',
    genre: 'ตลก',
    len: 30,
    style: 'bright',
    end: 'cta',
  },
  {
    id: 'street-food',
    label: 'ตำนานร้านข้าวผัดปูท้ายซอย',
    topic: 'เรื่องราวอบอุ่นของป้าขายข้าวผัดท้ายซอยที่เปิดไฟรอคนเลิกงานดึก',
    facts: '',
    mode: 'story',
    genre: 'ดราม่าซึ้ง',
    len: 60,
    style: 'street',
    end: 'summary',
  },
];

export const DEMO_PROJECT: CartoonProject = {
  title: 'ทำไมตื่นตี 3 แล้วหลับต่อยาก',
  style: 'night',
  end: 'summary',
  characters: [
    {
      id: 'C1',
      name: 'ต้นกล้า',
      skin: '#f1c27d',
      hair: '#2b211b',
      hairStyle: 'short',
      shirt: '#6366f1',
      glasses: true,
    },
    {
      id: 'C2',
      name: 'หมอปิ่น',
      skin: '#f6d5b0',
      hair: '#3b241c',
      hairStyle: 'bun',
      shirt: '#14b8a6',
      glasses: false,
    },
  ],
  scenes: [
    {
      narration: 'เคยไหม, สะดุ้งตื่นตอนตีสาม, แล้วตาค้างจนเช้า.',
      mood: 'dark',
      actors: [{ char: 'C1', x: 0.5, pose: 'scared', face: 'surprised', flip: false }],
      card: { type: 'text', text: 'ตี 3 นาฬิกาชีวิตปลุก?', at: 'ตีสาม' },
      fx: 'fog',
      hl: ['ตีสาม', 'ตาค้าง'],
    },
    {
      narration: 'หลายคนคิดว่าผีอำ, แต่จริงๆ เป็นระบบในสมองล้วนๆ.',
      mood: 'night',
      actors: [
        { char: 'C1', x: 0.3, pose: 'think', face: 'sad', flip: false },
        { char: 'C2', x: 0.72, pose: 'talk', face: 'smirk', flip: true },
      ],
      card: null,
      fx: 'none',
      hl: ['ระบบในสมอง'],
    },
    {
      narration: 'การนอนหนึ่งรอบใช้เวลา 90 นาที, ช่วงตีสามคือรอยต่อที่หลับตื้นสุด.',
      mood: 'room',
      actors: [{ char: 'C2', x: 0.28, pose: 'talk', face: 'happy', flip: false }],
      card: { type: 'bignumber', text: '90 นาที', label: 'ต่อ 1 รอบการนอน', at: '90 นาที' },
      fx: 'sparkles',
      hl: ['90 นาที', 'หลับตื้น'],
    },
    {
      narration: 'พอยิ่งหยิบมือถือมาดูเวลา, แสงสีฟ้าก็ยิ่งสั่งให้สมองตื่นเต็มตัว.',
      mood: 'dark',
      actors: [{ char: 'C1', x: 0.5, pose: 'scared', face: 'scared', flip: false }],
      card: {
        type: 'list',
        text: 'อย่าทำ 3 อย่างนี้ตอนตื่นดึก',
        items: ['เปิดดูนาฬิกามือถือ', 'เปิดไฟสว่างจ้า', 'นอนคิดเรื่องงาน'],
        at: 'มือถือ',
      },
      fx: 'none',
      hl: ['แสงสีฟ้า', 'ตื่นเต็มตัว'],
    },
    {
      narration: 'วิธีแก้คือไม่ต้องฝืนหลับ, แค่หายใจช้าๆ ในความมืดสักสิบนาที.',
      mood: 'night',
      actors: [
        { char: 'C2', x: 0.32, pose: 'idle', face: 'happy', flip: false },
        { char: 'C1', x: 0.7, pose: 'cheer', face: 'happy', flip: true },
      ],
      card: null,
      fx: 'sparkles',
      hl: ['หายใจช้าๆ'],
    },
    {
      narration: 'ปล่อยวางเวลา, แล้วร่างกายจะพากลับเข้าสู่ห้วงนิทราเอง.',
      mood: 'night',
      actors: [{ char: 'C1', x: 0.5, pose: 'cheer', face: 'happy', flip: false }],
      card: {
        type: 'end',
        badge: 'สรุปข้อคิด',
        text: 'วางมือถือ ปิดตา หายใจลึกๆ',
        label: 'บันทึกเก็บไว้ใช้คืนนี้เลย',
        at: 'ปล่อยวาง',
      },
      fx: 'sparkles',
      hl: ['ห้วงนิทรา'],
    },
  ],
};

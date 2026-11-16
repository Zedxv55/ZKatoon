import type {
  EndingType,
  StudioCard,
  StudioCharacter,
  StudioEpisode,
  StudioProject,
  StudioScene,
  ValidationFixItem,
  ValidationReport,
} from '../types/studio';
import {
  AMBIENT_TYPES,
  BG_PRESETS,
  CAMERA_SHOTS,
  CAMERA_TYPES,
  FACES,
  FX_TYPES,
  LOOK_GRADES,
  POSES,
  SFX_NAMES,
  TRANSITION_TYPES,
  mapToClosest,
} from './registry';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function makeExtraCharacter(index: number): StudioCharacter {
  const hairs = ['#1f2937', '#3b2f2f', '#5c3d2e', '#78350f'];
  const outfits = ['#e11d48', '#eab308', '#a855f7', '#10b981', '#64748b'];
  const styles = ['short', 'long', 'ponytail', 'curly'] as const;
  return {
    id: `E${index}`,
    name: `ตัวประกอบ ${index}`,
    role: 'extra',
    personality: 'ประชาชนในฉาก',
    species: 'human',
    age: 'adult',
    body: 'normal',
    skin: '#f2c8a2',
    hair: { style: styles[(index - 1) % styles.length], color: hairs[(index - 1) % hairs.length] },
    outfit: { type: 'tshirt', color: outfits[(index - 1) % outfits.length], accent: '#ffffff' },
    accessories: [],
    signature: `extra-${index}`,
    locked: false,
  };
}

function endingDefaults(endingType: EndingType): { badge: string; headline: string; subline: string; cta: string } {
  switch (endingType) {
    case 'twist':
      return {
        badge: 'จุดหักมุม',
        headline: 'ความจริงที่ซ่อนอยู่',
        subline: 'คุณเดาตอนจบถูกตั้งแต่แรกหรือไม่?',
        cta: 'ดูซ้ำเพื่อเก็บรายละเอียด',
      };
    case 'summary':
      return {
        badge: 'สรุปสำคัญ',
        headline: 'ประเด็นหลักที่ต้องจำ',
        subline: 'บันทึกไว้ทบทวนและแชร์ต่อได้ทันที',
        cta: 'กดบันทึกคลิปนี้',
      };
    case 'next':
      return {
        badge: 'ตอนต่อไป',
        headline: 'เรื่องราวยังไม่จบแค่นี้',
        subline: 'ติดตามเรื่องราวต่อในตอนหน้า',
        cta: 'สร้างตอนที่ 2 ต่อจาก Series Bible',
      };
    default:
      return {
        badge: 'ชวนคุย',
        headline: 'แล้วคุณคิดเห็นอย่างไร?',
        subline: 'พิมพ์ความคิดเห็นและมุมมองของคุณใต้คลิปนี้',
        cta: 'แสดงความคิดเห็น',
      };
  }
}

export function validateAndFixEpisode(
  project: StudioProject,
  episode: StudioEpisode,
  options?: { fullScript?: string }
): { project: StudioProject; episode: StudioEpisode; report: ValidationReport } {
  const fixes: ValidationFixItem[] = [];
  const warnings: string[] = [];
  const chars = [...project.characters];
  const charMap = new Map(chars.map((c) => [c.id, c]));
  const allowedSources = (project.settings.sourceNotes || []).map((s) => s.trim()).filter(Boolean);
  const combinedNumbersText = [
    options?.fullScript || '',
    ...episode.scenes.map((s) => s.narration || ''),
    ...allowedSources,
  ].join(' ');

  const seenIds = new Set<string>();
  const usedGrades = new Set<string>();
  const fixedScenes: StudioScene[] = [];

  for (let i = 0; i < episode.scenes.length; i++) {
    const raw = episode.scenes[i];
    let id = String(raw.id || `S${i + 1}`).trim();
    if (!id || seenIds.has(id)) {
      const nextId = `S${i + 1}_${seenIds.size + 1}`;
      fixes.push({
        sceneId: id || `index_${i}`,
        field: 'id',
        before: id,
        after: nextId,
        reason: 'รหัสฉากซ้ำหรือว่าง แก้ให้ไม่ซ้ำ',
      });
      id = nextId;
    }
    seenIds.add(id);

    const narration = String(raw.narration || '');
    const bgRes = mapToClosest(
      raw.bg?.preset,
      BG_PRESETS,
      { night_city: 'city_night', river: 'harbor_dusk', temple: 'shrine_hall', cafe: 'noodle_shop', home: 'room' },
      'city_night'
    );
    if (bgRes.changed) {
      fixes.push({ sceneId: id, field: 'bg.preset', before: String(raw.bg?.preset || ''), after: bgRes.value, reason: 'ค่าพื้นหลังไม่อยู่ใน registry' });
    }

    const camTypeRes = mapToClosest(raw.camera?.type, CAMERA_TYPES, { zoom_in: 'push_in', zoom_out: 'pull_out' }, 'static');
    let camShotRes = mapToClosest(raw.camera?.shot, CAMERA_SHOTS, { closeup: 'close', establishing: 'wide' }, 'medium');
    if (camTypeRes.changed) {
      fixes.push({ sceneId: id, field: 'camera.type', before: String(raw.camera?.type || ''), after: camTypeRes.value, reason: 'มุมกล้องไม่อยู่ใน registry' });
    }
    if (camShotRes.changed) {
      fixes.push({ sceneId: id, field: 'camera.shot', before: String(raw.camera?.shot || ''), after: camShotRes.value, reason: 'ระยะภาพไม่อยู่ใน registry' });
    }

    const ambRes = mapToClosest(raw.ambient, AMBIENT_TYPES, { insects: 'night_insects', street: 'city' }, 'none');
    const transRes = mapToClosest(raw.transition, TRANSITION_TYPES, { dissolve: 'fade' }, 'fade');

    // Clamp & validate actors (max 4, x in 0.12-0.88, two-sided wide x≈0.28/0.72, distinct extra IDs)
    const rawActors = Array.isArray(raw.actors) ? raw.actors.slice(0, 4) : [];
    if ((raw.actors?.length || 0) > 4) {
      fixes.push({ sceneId: id, field: 'actors', before: `${raw.actors.length} ตัว`, after: '4 ตัว', reason: 'จำกัดไม่เกิน 4 ตัวละครต่อฉาก' });
    }

    let extraSeq = 1;
    const seenExtraInScene = new Set<string>();
    const actors = rawActors.map((a, aIdx) => {
      const poseRes = mapToClosest(a.pose, POSES, { speaking: 'talk', standing: 'idle', happy: 'cheer' }, 'idle');
      const faceRes = mapToClosest(a.face, FACES, { worried: 'sad', shock: 'surprised' }, 'neutral');
      if (poseRes.changed) fixes.push({ sceneId: id, field: `actors[${aIdx}].pose`, before: String(a.pose), after: poseRes.value, reason: 'ท่าไม่อยู่ใน registry' });
      if (faceRes.changed) fixes.push({ sceneId: id, field: `actors[${aIdx}].face`, before: String(a.face), after: faceRes.value, reason: 'สีหน้าไม่อยู่ใน registry' });

      let charId = a.char;
      const cDef = charMap.get(charId);
      let scale = Number.isFinite(a.scale) ? a.scale : 1;
      if (cDef?.role === 'extra') {
        if (seenExtraInScene.has(charId)) {
          while (seenExtraInScene.has(`E${extraSeq}`)) extraSeq++;
          const newExtraId = `E${extraSeq}`;
          if (!charMap.has(newExtraId)) {
            const extraChar = makeExtraCharacter(extraSeq);
            chars.push(extraChar);
            charMap.set(newExtraId, extraChar);
          }
          fixes.push({ sceneId: id, field: `actors[${aIdx}].char`, before: charId, after: newExtraId, reason: 'ตัวประกอบกลุ่มต้องไม่ก๊อปปี้ตัวเดียวซ้ำ' });
          charId = newExtraId;
        }
        seenExtraInScene.add(charId);
        if (scale < 0.6 || scale > 0.8) {
          scale = clamp(scale, 0.6, 0.8);
          fixes.push({ sceneId: id, field: `actors[${aIdx}].scale`, before: String(a.scale), after: String(scale), reason: 'ปรับ scale ตัวประกอบให้อยู่ช่วง 0.6-0.8' });
        }
      } else if (cDef?.role === 'main' && rawActors.length === 1 && scale < 1) {
        scale = 1.05;
      }

      let x = clamp(Number.isFinite(a.x) ? a.x : 0.5, 0.12, 0.88);
      if (x !== a.x) {
        fixes.push({ sceneId: id, field: `actors[${aIdx}].x`, before: String(a.x), after: String(x), reason: 'ขยับตำแหน่ง x ให้อยู่ในกรอบ 0.12-0.88' });
      }
      const y = clamp(Number.isFinite(a.y) ? a.y : 0.78, 0.25, 0.94);
      const moveTo = a.moveTo
        ? {
            x: clamp(a.moveTo.x, 0.12, 0.88),
            y: clamp(a.moveTo.y, 0.25, 0.94),
            atText: narration.includes(a.moveTo.atText) ? a.moveTo.atText : narration.slice(0, 8),
          }
        : undefined;

      return {
        ...a,
        char: charId,
        x,
        y,
        scale,
        pose: poseRes.value,
        face: faceRes.value,
        moveTo,
      };
    });

    // Two-sided scene normalization: wide shot + x≈0.28 / 0.72 if touching or extreme
    if (actors.length === 2 && Math.abs(actors[0].x - actors[1].x) < 0.18) {
      actors[0] = { ...actors[0], x: 0.28 };
      actors[1] = { ...actors[1], x: 0.72 };
      camShotRes = { value: 'wide', changed: camShotRes.value !== 'wide' };
      fixes.push({ sceneId: id, field: 'actors/shot', before: 'ชิดกันเกินไป', after: 'wide x=0.28 / 0.72', reason: 'ฉากสองฝั่งควรวาง x≈0.28 และ 0.72' });
    }
    if (actors.some((a) => charMap.get(a.char)?.role === 'main' && a.scale >= 1.0) && actors.length === 1 && camShotRes.value === 'wide') {
      camShotRes = { value: 'medium', changed: true };
      fixes.push({ sceneId: id, field: 'camera.shot', before: 'wide', after: 'medium', reason: 'ตัวเอกเป็นจุดสนใจควรใช้ medium/close' });
    }

    // Clamp props & check appearAtText
    const props = (raw.props || []).slice(0, 6).map((p, pIdx) => {
      const px = clamp(Number.isFinite(p.x) ? p.x : 0.5, 0.12, 0.88);
      if (px !== p.x) {
        fixes.push({ sceneId: id, field: `props[${pIdx}].x`, before: String(p.x), after: String(px), reason: 'ปรับตำแหน่งพร็อพให้อยู่ 0.12-0.88' });
      }
      let appearAtText = p.appearAtText;
      if (appearAtText && !narration.includes(appearAtText)) {
        warnings.push(`ฉาก ${id}: appearAtText "${appearAtText}" ไม่พบในบทพากย์ ระบบย้ายไปต้นฉาก`);
        appearAtText = '';
      }
      return { ...p, x: px, y: clamp(Number.isFinite(p.y) ? p.y : 0.72, 0.12, 0.92), appearAtText };
    });

    // Highlight words must exist verbatim in narration
    const highlightWords = (raw.highlightWords || []).filter((w) => {
      if (!w) return false;
      if (!narration.includes(w)) {
        warnings.push(`ฉาก ${id}: คำไฮไลต์ "${w}" ไม่ตรงตัวใน narration`);
        return false;
      }
      return true;
    });

    // Max 2 cards simultaneously & filter source_note if user gave no sources + validate numbers in cards
    const cards: StudioCard[] = [];
    for (const c of (raw.cards || []).slice(0, 2)) {
      if (c.type === 'source_note') {
        const text = String(c.text || '').trim();
        if (!allowedSources.some((src) => text.includes(src) || src.includes(text))) {
          fixes.push({ sceneId: id, field: 'cards.source_note', before: text, after: 'นำออก', reason: 'ไม่อนุญาตแสดงแหล่งอ้างอิงที่ผู้ใช้ไม่ได้ให้ไว้' });
          continue;
        }
      }
      if (c.type === 'bignumber' && c.text) {
        const digits = String(c.text).replace(/[^\d]/g, '');
        if (digits && !combinedNumbersText.includes(digits)) {
          warnings.push(`ฉาก ${id}: ตัวเลข "${c.text}" บนการ์ดไม่ปรากฏในบทหรือข้อมูลผู้ใช้ โปรดตรวจสอบ`);
        }
      }
      let atText = c.atText;
      if (atText && !narration.includes(atText)) {
        warnings.push(`ฉาก ${id}: การ์ด "${c.type}" atText "${atText}" ไม่พบในบทพากย์ ย้ายไปต้นฉาก`);
        atText = '';
      }
      cards.push({ ...c, atText });
    }
    if ((raw.cards?.length || 0) > 2) {
      fixes.push({ sceneId: id, field: 'cards', before: `${raw.cards.length} ใบ`, after: '2 ใบ', reason: 'จำกัดการ์ดพร้อมกันไม่เกิน 2 ใบ' });
    }

    // FX, SFX, Look grade (max 4 distinct look grades per episode)
    const fx = (raw.fx || []).map((f) => ({
      type: mapToClosest(f.type, FX_TYPES, {}, 'dust').value,
      intensity: clamp(f.intensity ?? 0.5, 0, 1),
    }));
    const sfx = (raw.sfx || []).map((cue) => ({
      ...cue,
      name: cue.name ? mapToClosest(cue.name, SFX_NAMES, {}, 'pop').value : undefined,
      atText: cue.atText && narration.includes(cue.atText) ? cue.atText : '',
      vol: clamp(cue.vol ?? 0.4, 0, 1),
    }));

    let look = raw.look;
    if (look) {
      const gradeRes = mapToClosest(look.grade, LOOK_GRADES, {}, 'neutral_day');
      let finalGrade = gradeRes.value;
      if (!usedGrades.has(finalGrade)) {
        if (usedGrades.size >= 4) {
          finalGrade = Array.from(usedGrades)[usedGrades.size - 1] as typeof finalGrade;
          fixes.push({ sceneId: id, field: 'look.grade', before: gradeRes.value, after: finalGrade, reason: 'จำกัด Look Grade ไม่เกิน 4 แบบต่อตอน' });
        } else {
          usedGrades.add(finalGrade);
        }
      }
      look = { ...look, grade: finalGrade, practicals: (look.practicals || []).slice(0, 3) };
    }

    // Prevent 3 consecutive scenes having identical shot & bg
    let shotFinal = camShotRes.value;
    let bgFinal = bgRes.value;
    if (i >= 2) {
      const p1 = fixedScenes[i - 1];
      const p2 = fixedScenes[i - 2];
      if (
        p1.bg.preset === bgFinal &&
        p2.bg.preset === bgFinal &&
        p1.camera.shot === shotFinal &&
        p2.camera.shot === shotFinal
      ) {
        shotFinal = shotFinal === 'medium' ? 'close' : shotFinal === 'wide' ? 'medium' : 'wide';
        fixes.push({
          sceneId: id,
          field: 'camera.shot',
          before: camShotRes.value,
          after: shotFinal,
          reason: 'ป้องกัน 3 ฉากติดกันใช้มุมและพื้นหลังซ้ำเดิม',
        });
      }
    }

    fixedScenes.push({
      ...raw,
      id,
      narration,
      highlightWords,
      holdAfter: clamp(Number.isFinite(raw.holdAfter) ? raw.holdAfter : 0.25, 0, 10),
      bg: { ...raw.bg, preset: bgFinal },
      actors,
      props,
      cards,
      camera: { type: camTypeRes.value, shot: shotFinal },
      fx,
      sfx,
      ambient: ambRes.value,
      transition: transRes.value,
      look,
    });
  }

  // Last scene must include an end_card matching endingType and >= 2.5s hold/duration
  if (fixedScenes.length > 0) {
    const lastIdx = fixedScenes.length - 1;
    const last = fixedScenes[lastIdx];
    const hasEndCard = last.cards.some((c) => c.type === 'end_card');
    if (!hasEndCard) {
      const d = endingDefaults(episode.endingType);
      const nextCards = last.cards.slice(0, 1);
      nextCards.push({
        type: 'end_card',
        badge: d.badge,
        headline: d.headline,
        subline: d.subline,
        cta: d.cta,
      });
      fixedScenes[lastIdx] = {
        ...last,
        holdAfter: Math.max(last.holdAfter || 0, 2.5),
        cards: nextCards,
      };
      fixes.push({
        sceneId: last.id,
        field: 'cards.end_card',
        before: 'ไม่มี end_card',
        after: `เพิ่ม end_card (${episode.endingType}) + holdAfter 2.5s`,
        reason: 'ฉากสุดท้ายต้องมี end_card ตาม endingType',
      });
    } else if ((last.holdAfter || 0) < 2.5) {
      fixedScenes[lastIdx] = { ...last, holdAfter: 2.5 };
    }
  }

  // Check exact script preservation
  const joinedNarration = fixedScenes.map((s) => s.narration).join('\n');
  let scriptExactMatch = true;
  if (options?.fullScript && options.fullScript.trim().length > 0) {
    const normalizeWs = (t: string) => t.replace(/\r\n/g, '\n').trim();
    scriptExactMatch = normalizeWs(joinedNarration) === normalizeWs(options.fullScript);
    if (!scriptExactMatch) {
      warnings.push('บทพากย์รวมของทุกฉากไม่ตรงกับบทต้นฉบับทุกตัวอักษร (ตรวจสอบการตัดแบ่งฉาก)');
    }
  }

  // Warn if scene count or expected durations look too short/long (~4-9s/scene)
  for (const s of fixedScenes) {
    const est = Math.max(1.2, s.narration.length / 11);
    if (est < 2.2 || est > 11.5) {
      warnings.push(`ฉาก ${s.id} ความยาวประมาณ ${est.toFixed(1)} วิ (แนะนำช่วง 4-9 วิ/ฉาก)`);
    }
  }

  const nextEpisode: StudioEpisode = { ...episode, scenes: fixedScenes };
  const nextProject: StudioProject = {
    ...project,
    characters: chars,
    episodes: project.episodes.map((ep) => (ep.id === episode.id ? nextEpisode : ep)),
  };

  return {
    project: nextProject,
    episode: nextEpisode,
    report: {
      ok: warnings.length === 0,
      warnings,
      fixes,
      scriptExactMatch,
    },
  };
}

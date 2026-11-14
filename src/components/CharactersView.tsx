import { useEffect, useRef, useState } from 'react';
import { Box, CheckCircle2, Plus, RotateCw, Trash2, Upload, UserCheck } from 'lucide-react';
import { CharacterPreviewStage } from '../engine3d/ThreeSceneStage';
import { inspectGlbBlob } from '../engine3d/characterRig3d';
import type {
  AccessoryType,
  ActorFace,
  AnimationClip3D,
  CartoonProject,
  CharacterDef,
  HairStyle,
  OutfitType,
  StylePreset3D,
} from '../types/cartoon';
import { ANIMATION_CLIPS_3D, STYLE_PRESETS_3D } from '../utils/cartoonData';
import { generateUuid } from '../utils/workspaceCrypto';
import { saveGlbAsset } from '../utils/workspaceStore';

interface CharactersViewProps {
  workspaceId: string;
  project: CartoonProject | null;
  onUpdateProject: (next: CartoonProject) => void;
  onOpenDemo3D: () => void;
  onNotify: (msg: string) => void;
}

const HAIR_OPTIONS: Array<{ id: HairStyle; label: string }> = [
  { id: 'short', label: 'ผมสั้น' },
  { id: 'long', label: 'ผมยาว' },
  { id: 'bun', label: 'มวยผม' },
  { id: 'ponytail', label: 'หางม้า' },
  { id: 'curly', label: 'ผมหยิก' },
  { id: 'cap', label: 'หมวกแก๊ป' },
  { id: 'bald', label: 'ไม่มีผม' },
];

const OUTFIT_OPTIONS: Array<{ id: OutfitType; label: string }> = [
  { id: 'tshirt', label: 'เสื้อยืด' },
  { id: 'hoodie', label: 'ฮู้ด' },
  { id: 'coat', label: 'เสื้อโค้ต' },
  { id: 'plaid_shirt', label: 'เสื้อเชิ้ตลาย' },
  { id: 'suit', label: 'สูททางการ' },
  { id: 'uniform', label: 'เครื่องแบบ' },
  { id: 'dress', label: 'ชุดกระโปรง' },
  { id: 'apron', label: 'ผ้ากันเปื้อน' },
];

const ACCESSORY_LIST: Array<{ id: AccessoryType; label: string }> = [
  { id: 'glasses', label: 'แว่นตา' },
  { id: 'backpack', label: 'เป้สะพายหลัง' },
  { id: 'scarf', label: 'ผ้าพันคอ' },
  { id: 'hat', label: 'หมวกปีก' },
  { id: 'flower_hat', label: 'หมวกดอกไม้' },
  { id: 'headphones', label: 'หูฟัง' },
];

const FACES: Array<{ id: ActorFace; label: string }> = [
  { id: 'happy', label: 'ยิ้ม' },
  { id: 'neutral', label: 'ปกติ' },
  { id: 'sad', label: 'เศร้า' },
  { id: 'surprised', label: 'ตกใจ' },
  { id: 'angry', label: 'โกรธ' },
  { id: 'worried', label: 'กังวล' },
  { id: 'scared', label: 'กลัว' },
];

export function CharactersView({
  workspaceId,
  project,
  onUpdateProject,
  onOpenDemo3D,
  onNotify,
}: CharactersViewProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [previewClip, setPreviewClip] = useState<AnimationClip3D>('Idle');
  const [previewFace, setPreviewFace] = useState<ActorFace>('happy');
  const [autoRotate, setAutoRotate] = useState(true);
  const [previewStyle3d, setPreviewStyle3d] = useState<StylePreset3D>(
    project?.style3d || 'cinematic_3d'
  );
  const [uploadingGlb, setUploadingGlb] = useState(false);

  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<CharacterPreviewStage | null>(null);

  const characters = project?.characters || [];
  const activeChar: CharacterDef | undefined = characters[selectedIdx] || characters[0];

  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el || !project) return;
    const stage = new CharacterPreviewStage(el, previewStyle3d);
    stageRef.current = stage;
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [Boolean(project)]);

  useEffect(() => {
    if (!stageRef.current || !activeChar) return;
    void stageRef.current.setCharacter(activeChar, previewStyle3d);
  }, [activeChar, previewStyle3d]);

  useEffect(() => {
    stageRef.current?.setClip(previewClip);
  }, [previewClip]);

  useEffect(() => {
    stageRef.current?.setFace(previewFace);
  }, [previewFace]);

  useEffect(() => {
    stageRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  if (!project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <Box className="mx-auto h-12 w-12 text-violet-400" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-white">ยังไม่มีโปรเจกต์ที่เปิดอยู่</h1>
        <p className="text-sm text-[#9894b8]">
          เปิดโปรเจกต์ตัวอย่าง 3D หรือสร้างเรื่องใหม่ก่อนเพื่อปรับแต่งตัวละคร 3D Bone Skeleton
        </p>
        <button
          type="button"
          onClick={onOpenDemo3D}
          className="min-h-[44px] rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 cursor-pointer"
        >
          เปิดโปรเจกต์ตัวอย่าง 3D ("คืนโคมไฟริมน้ำ")
        </button>
      </div>
    );
  }

  function updateChar(patch: Partial<CharacterDef>) {
    if (!project || !activeChar) return;
    const idx = characters.findIndex((c) => c.id === activeChar.id);
    if (idx < 0) return;
    const nextChars = [...characters];
    nextChars[idx] = { ...activeChar, ...patch };
    onUpdateProject({ ...project, characters: nextChars });
  }

  function handleAddCharacter() {
    if (!project) return;
    const id = `C${project.characters.length + 1}`;
    const newChar: CharacterDef = {
      id,
      name: `ตัวละคร ${project.characters.length + 1}`,
      role: 'ตัวละครสมทบ',
      gender: 'neutral',
      species: 'human',
      age: 'adult',
      body: 'normal',
      proportion3d: 'stylized',
      skin: '#f2c8a2',
      hair: '#2b2522',
      hairStyle: 'short',
      shirt: '#10b981',
      pants: '#334155',
      shoes: '#0f172a',
      outfit: 'tshirt',
    };
    onUpdateProject({ ...project, characters: [...project.characters, newChar] });
    setSelectedIdx(project.characters.length);
  }

  async function handleUploadGlb(file: File) {
    if (!activeChar) return;
    setUploadingGlb(true);
    try {
      const inspected = await inspectGlbBlob(file);
      const assetId = generateUuid();
      await saveGlbAsset({
        id: assetId,
        workspaceId,
        fileName: file.name,
        blob: file,
        sizeBytes: file.size,
        hasSkeleton: inspected.hasSkeleton,
        boneNames: inspected.boneNames,
        clipNames: inspected.clipNames,
        uploadedAt: Date.now(),
      });
      updateChar({
        glbAssetId: assetId,
        glbFileName: file.name,
        glbHasSkeleton: inspected.hasSkeleton,
        glbClipNames: inspected.clipNames,
      });
      onNotify(
        `อัปโหลด ${file.name} สำเร็จ (${inspected.meshCount} meshes, ${inspected.boneNames.length} bones, ${inspected.clipNames.length} clips)`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ GLB/GLTF นี้ได้');
    } finally {
      setUploadingGlb(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            สตูดิโอออกแบบตัวละคร 3D — {project.title}
          </h1>
          <p className="mt-1 text-sm text-[#9894b8]">
            ปรับแต่งโครงกระดูก Bone/Skeleton 3 มิติ สัดส่วน เสื้อผ้า ทรงผม ท่าทางแอนิเมชัน หรือนำเข้าโมเดล .glb/.gltf ของคุณเอง
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddCharacter}
          className="inline-flex items-center gap-1.5 min-h-[42px] rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer self-start"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>เพิ่มตัวละครใหม่</span>
        </button>
      </div>

      {/* Character Selector Strip */}
      <div className="flex flex-wrap gap-2">
        {characters.map((ch, idx) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => setSelectedIdx(idx)}
            className={`inline-flex items-center gap-2 min-h-[40px] rounded-xl border px-3.5 text-xs font-semibold transition-colors cursor-pointer ${
              selectedIdx === idx
                ? 'border-violet-500 bg-violet-500/20 text-white'
                : 'border-white/10 bg-[#13141d] text-[#d6d3eb] hover:border-white/25'
            }`}
          >
            <span
              className="h-3 w-3 rounded-full border border-white/30"
              style={{ backgroundColor: ch.shirt }}
            />
            <span>{ch.name}</span>
            {ch.glbFileName && <span className="text-[10px] text-emerald-300">GLB</span>}
          </button>
        ))}
      </div>

      {activeChar && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Live Interactive 3D Canvas Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">ตัวอย่างโมเดล 3D แบบเรียลไทม์</span>
                <button
                  type="button"
                  onClick={() => setAutoRotate((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#1b1d29] px-2.5 py-1 text-[11px] text-[#d6d3eb] hover:text-white cursor-pointer"
                >
                  <RotateCw className="h-3 w-3" aria-hidden="true" />
                  <span>{autoRotate ? 'กำลังหมุนโชว์' : 'หยุดหมุน'}</span>
                </button>
              </div>

              <div
                ref={stageContainerRef}
                data-testid="character-3d-canvas"
                className="relative h-[360px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#0b0d16]"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[#9894b8] mb-1">ทดสอบท่าแอนิเมชัน 3D</label>
                  <select
                    value={previewClip}
                    onChange={(e) => setPreviewClip(e.target.value as AnimationClip3D)}
                    className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
                  >
                    {ANIMATION_CLIPS_3D.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#9894b8] mb-1">ทดสอบสีหน้า</label>
                  <select
                    value={previewFace}
                    onChange={(e) => setPreviewFace(e.target.value as ActorFace)}
                    className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
                  >
                    {FACES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#9894b8] mb-1">ทดสอบ Style Rendering</label>
                <select
                  value={previewStyle3d}
                  onChange={(e) => {
                    const nextS = e.target.value as StylePreset3D;
                    setPreviewStyle3d(nextS);
                    onUpdateProject({ ...project, style3d: nextS });
                  }}
                  className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
                >
                  {STYLE_PRESETS_3D.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* GLB / GLTF Custom 3D Importer */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">นำเข้าโมเดล 3D (.glb / .gltf)</h2>
                {activeChar.glbAssetId && (
                  <button
                    type="button"
                    onClick={() =>
                      updateChar({
                        glbAssetId: undefined,
                        glbFileName: undefined,
                        glbHasSkeleton: undefined,
                        glbClipNames: undefined,
                      })
                    }
                    className="text-xs text-rose-300 hover:underline cursor-pointer"
                  >
                    กลับไปใช้หุ่น Skeleton ในตัว
                  </button>
                )}
              </div>

              <label className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-dashed border-violet-400/50 bg-violet-500/10 px-4 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 cursor-pointer">
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{uploadingGlb ? 'กำลังตรวจสอบไฟล์ 3D…' : 'เลือกไฟล์ .glb หรือ .gltf (เก็บในเครื่อง)'}</span>
                <input
                  type="file"
                  accept=".glb,.gltf"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadGlb(f);
                    e.target.value = '';
                  }}
                />
              </label>

              {activeChar.glbFileName && (
                <div className="rounded-xl border border-white/10 bg-[#0b0c12] p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{activeChar.glbFileName}</span>
                  </div>
                  <p className="text-[#9894b8]">
                    Skeleton:{' '}
                    {activeChar.glbHasSkeleton
                      ? 'พบโครงกระดูก (SkinnedMesh/Bones)'
                      : 'ไม่พบกระดูก — ระบบจะแสดงการขยับเบาๆ แทน'}
                  </p>
                  <p className="text-[#9894b8]">
                    Animation Clips:{' '}
                    {activeChar.glbClipNames?.length
                      ? activeChar.glbClipNames.join(', ')
                      : 'ไม่มีคลิปแอนิเมชันฝังมาในไฟล์'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Character Profile & Rig Config */}
          <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-violet-400" aria-hidden="true" />
                <span>ข้อมูลตัวละคร ({activeChar.id})</span>
              </h2>
              {characters.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = characters.filter((c) => c.id !== activeChar.id);
                    onUpdateProject({ ...project, characters: next });
                    setSelectedIdx(0);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-rose-300 hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>ลบตัวละครนี้</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-[#9894b8] mb-1">ชื่อตัวละคร</label>
                <input
                  type="text"
                  value={activeChar.name}
                  onChange={(e) => updateChar({ name: e.target.value })}
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9894b8] mb-1">บทบาทในเรื่อง</label>
                <input
                  type="text"
                  value={activeChar.role || ''}
                  onChange={(e) => updateChar({ role: e.target.value })}
                  placeholder="เช่น ตัวเอก / นักสืบ / คุณปู่"
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-[#9894b8] mb-1">สายพันธุ์ / รูปแบบ</label>
                <select
                  value={activeChar.species || 'human'}
                  onChange={(e) => updateChar({ species: e.target.value as CharacterDef['species'] })}
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  <option value="human">มนุษย์ (Human)</option>
                  <option value="cat">แมว (Cat Ears)</option>
                  <option value="dog">สุนัข (Dog Ears)</option>
                  <option value="robot">หุ่นยนต์ (Robot Visor)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#9894b8] mb-1">สัดส่วน 3D (Proportion)</label>
                <select
                  value={activeChar.proportion3d || 'stylized'}
                  onChange={(e) =>
                    updateChar({ proportion3d: e.target.value as CharacterDef['proportion3d'] })
                  }
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  <option value="stylized">Stylized (หัวโตพอดี น่ารัก)</option>
                  <option value="chibi">Chibi (หัวโตน่ารักมาก)</option>
                  <option value="realistic">Semi-Realistic (สัดส่วนสมจริง)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#9894b8] mb-1">ช่วงวัย (Age)</label>
                <select
                  value={activeChar.age || 'adult'}
                  onChange={(e) => updateChar({ age: e.target.value as CharacterDef['age'] })}
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  <option value="child">เด็ก (ตัวเล็ก)</option>
                  <option value="teen">วัยรุ่น</option>
                  <option value="adult">ผู้ใหญ่</option>
                  <option value="elder">ผู้สูงอายุ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#9894b8] mb-1">รูปร่าง (Body)</label>
                <select
                  value={activeChar.body || 'normal'}
                  onChange={(e) => updateChar({ body: e.target.value as CharacterDef['body'] })}
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  <option value="slim">เพรียว (Slim)</option>
                  <option value="normal">สมส่วน (Normal)</option>
                  <option value="chubby">ท้วมน่ารัก (Chubby)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#9894b8] mb-1">ทรงผม</label>
                <select
                  value={activeChar.hairStyle}
                  onChange={(e) => updateChar({ hairStyle: e.target.value as HairStyle })}
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  {HAIR_OPTIONS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#9894b8] mb-1">ชุดแต่งกาย</label>
                <select
                  value={activeChar.outfit || 'tshirt'}
                  onChange={(e) => updateChar({ outfit: e.target.value as OutfitType })}
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  {OUTFIT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color Swatches */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['skin', 'สีผิว'],
                  ['hair', 'สีผม'],
                  ['shirt', 'สีเสื้อ'],
                  ['pants', 'สีกางเกง'],
                ] as const
              ).map(([field, label]) => (
                <label
                  key={field}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-2 text-xs text-[#d6d3eb]"
                >
                  <span>{label}</span>
                  <input
                    type="color"
                    value={String(activeChar[field] || '#6366f1')}
                    onChange={(e) => updateChar({ [field]: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded bg-transparent"
                  />
                </label>
              ))}
            </div>

            {/* Accessories */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white">เครื่องประดับ (Accessories)</div>
              <div className="flex flex-wrap gap-2">
                {ACCESSORY_LIST.map((acc) => {
                  const hasAcc =
                    acc.id === 'glasses'
                      ? Boolean(activeChar.glasses || activeChar.accessories?.includes('glasses'))
                      : Boolean(activeChar.accessories?.includes(acc.id));
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        const prev = new Set(activeChar.accessories || []);
                        if (hasAcc) prev.delete(acc.id);
                        else prev.add(acc.id);
                        updateChar({
                          accessories: [...prev],
                          ...(acc.id === 'glasses' ? { glasses: !hasAcc } : {}),
                        });
                      }}
                      className={`min-h-[36px] rounded-lg border px-3 text-xs font-medium cursor-pointer ${
                        hasAcc
                          ? 'border-violet-500 bg-violet-500/20 text-white'
                          : 'border-white/10 bg-[#1b1d29] text-[#9894b8]'
                      }`}
                    >
                      {acc.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Personality & Walk Style */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-[#9894b8] mb-1">บุคลิกตัวละคร</label>
                <input
                  type="text"
                  value={activeChar.personality || ''}
                  onChange={(e) => updateChar({ personality: e.target.value })}
                  placeholder="เช่น ใจดี ขี้สงสัย กล้าหาญ"
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9894b8] mb-1">สไตล์ท่าทางประจำตัว</label>
                <select
                  value={activeChar.signaturePose || 'Idle'}
                  onChange={(e) => updateChar({ signaturePose: e.target.value as AnimationClip3D })}
                  className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  {ANIMATION_CLIPS_3D.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

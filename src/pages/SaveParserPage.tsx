import { useState, type Dispatch, type DragEvent, type SetStateAction } from 'react';
import { relicEffectsKo, relicItemColorMap, relics, relicRollAppData } from '../data/relics';
import type { RelicColor } from '../data/relics/types';
import {
  parseNightreignSaveFile,
  type CharacterSlot,
  type ParsedRelic,
  type RelicScanResult,
} from '../utils/nightreignSaveParser';

const characterSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const supportedSaveExtensions = ['.sl2', '.co2', '.dat'];

const relicLookup = new Map(
  relicItemColorMap.map((relic) => [
    relic.itemId,
    {
      color: relic.color,
      name: relic.name,
    },
  ]),
);

for (const relic of relics) {
  const current = relicLookup.get(relic.id);
  relicLookup.set(relic.id, {
    color: current?.color ?? relic.color,
    name: relic.name,
  });
}

const effectLookup = new Map(
  relicEffectsKo.map((effect) => [
    Number(effect.id),
    {
      name: effect.name,
      category: effect.category,
      dn: effect.dn,
      desc: effect.desc,
    },
  ]),
);

const debuffLookup = new Map<string, { name: string; desc: string }>();
for (const debuffTable of Object.values(relicRollAppData.debuffTables)) {
  for (const debuffEffect of debuffTable.effects) {
    debuffLookup.set(String(debuffEffect.id), {
      name: debuffEffect.effect_kor,
      desc: debuffEffect.effect_detail_kor,
    });
  }
}

const debuffEffectIds = new Set(debuffLookup.keys());
const emptyEffectId = 0xffffffff;
const relicColorNameMap: Record<RelicColor, string> = {
  Red: '빨강',
  Blue: '파랑',
  Yellow: '노랑',
  Green: '초록',
};
const relicColorAdjectiveMap: Record<RelicColor, string> = {
  Red: '불타는',
  Blue: '촉촉한',
  Yellow: '빛나는',
  Green: '고요한',
};
const relicNameSizeWordMap: Record<string, string> = {
  Delicate: '섬세한',
  Polished: '단정한',
  Grand: '웅장한',
};
const relicNameColorWordPattern = /불타는|촉촉한|빛나는|고요한|Burning|Drizzly|Luminous|Tranquil/g;

interface EffectDisplay {
  id: number;
  name: string;
  desc?: string;
  meta: string;
  isDebuff: boolean;
}

interface RelicEffectGroup {
  key: string;
  buff: EffectDisplay | null;
  debuff: EffectDisplay | null;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

function isSupportedSaveFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return supportedSaveExtensions.some((extension) => lowerName.endsWith(extension));
}

function getUnsupportedFileMessage(file: File) {
  return `${file.name}은 지원하지 않는 파일 형식입니다. .sl2, .co2, .dat 파일을 업로드해 주세요.`;
}

function normalizeRelicName(name: string, color: RelicColor) {
  const colorAdjective = relicColorAdjectiveMap[color];
  let normalizedName = name.replace(relicNameColorWordPattern, colorAdjective);

  for (const [englishWord, koreanWord] of Object.entries(relicNameSizeWordMap)) {
    normalizedName = normalizedName.replace(new RegExp(`\\b${englishWord}\\b`, 'g'), koreanWord);
  }

  return normalizedName.replace(/\bScene\b/g, '풍경');
}

function getRelicName(relic: ParsedRelic) {
  const color = getRelicColor(relic);
  const name = relicLookup.get(relic.itemId)?.name ?? `알 수 없는 유물 ${relic.itemId}`;
  return normalizeRelicName(name, color);
}

function getRelicColor(relic: ParsedRelic): RelicColor {
  return relicLookup.get(relic.itemId)?.color ?? relic.color;
}

function getColorName(color: RelicColor): string {
  return relicColorNameMap[color] || color;
}

function isUsableEffectId(effectId: number) {
  return effectId !== emptyEffectId && effectId !== -1;
}

function getEffectDisplay(effectId: number): EffectDisplay {
  const isDebuff = debuffEffectIds.has(String(effectId));
  const effect = effectLookup.get(effectId);
  const debuff = isDebuff ? debuffLookup.get(String(effectId)) : null;
  const displayName = isDebuff ? debuff?.name : effect?.name;
  const displayDesc = isDebuff ? debuff?.desc : effect?.desc;
  const metaParts = [
    String(effectId),
    effect?.category,
    !isDebuff && effect?.dn ? 'dn' : '',
    isDebuff ? '디버프' : '',
  ].filter(Boolean);

  return {
    id: effectId,
    name: displayName ?? `알 수 없는 효과 ${effectId}`,
    desc: displayDesc,
    meta: metaParts.join(' / '),
    isDebuff,
  };
}

function getRelicEffectGroups(relic: ParsedRelic): RelicEffectGroup[] {
  const buffIds = [relic.raw.effect1Id, relic.raw.effect2Id, relic.raw.effect3Id];
  const debuffIds = [relic.raw.effect4Id, relic.raw.effect5Id, relic.raw.effect6Id];
  const groups = buffIds
    .map((buffId, index) => {
      const debuffId = debuffIds[index];
      const buff = isUsableEffectId(buffId) ? getEffectDisplay(buffId) : null;
      const debuff = isUsableEffectId(debuffId) ? getEffectDisplay(debuffId) : null;

      if (!buff && !debuff) {
        return null;
      }

      return {
        key: `${buffId}-${debuffId}-${index}`,
        buff,
        debuff,
      };
    })
    .filter((group): group is RelicEffectGroup => Boolean(group));

  if (groups.length > 0) {
    return groups;
  }

  return relic.effects.map((effectId) => {
    const effect = getEffectDisplay(effectId);
    return {
      key: String(effectId),
      buff: effect.isDebuff ? null : effect,
      debuff: effect.isDebuff ? effect : null,
    };
  });
}

function RelicResultCard({ relic }: { relic: ParsedRelic }) {
  const color = getRelicColor(relic);
  const effectGroups = getRelicEffectGroups(relic);

  return (
    <article className="option-card save-relic-card">
      <div className="option-card-header">
        <span className={`option-category relic-color-${String(color).toLowerCase()}`}>
          {getColorName(color)}
        </span>
      </div>
      <h3>{getRelicName(relic)}</h3>

      <div className="save-effect-list">
        {effectGroups.length ? (
          effectGroups.map((group) => (
            <div
              key={group.key}
              className={`save-effect-item${group.debuff ? ' has-debuff' : ''}${!group.buff && group.debuff ? ' is-debuff' : ''}`}
            >
              {group.buff ? (
                <>
                  <strong>{group.buff.name}</strong>
                  {group.buff.desc ? <p className="save-effect-desc">{group.buff.desc}</p> : null}
                  <span className="save-effect-meta">{group.buff.meta}</span>
                </>
              ) : null}
              {group.debuff ? (
                <div className="save-linked-debuff">
                  <span className="save-debuff-label">디버프</span>
                  <strong>{group.debuff.name}</strong>
                  {group.debuff.desc ? <p className="save-effect-desc">{group.debuff.desc}</p> : null}
                  <span className="save-effect-meta">{group.debuff.meta}</span>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="muted-text">효과 없음</p>
        )}
      </div>
    </article>
  );
}

type SaveParserPageProps = {
  characterSlot: CharacterSlot;
  setCharacterSlot: (slot: CharacterSlot) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  result: RelicScanResult | null;
  setResult: (result: RelicScanResult | null) => void;
  logs: string[];
  setLogs: Dispatch<SetStateAction<string[]>>;
  error: string | null;
  setError: (error: string | null) => void;
  isParsing: boolean;
  setIsParsing: (isParsing: boolean) => void;
  clearCache: () => void;
};

function SaveParserPage({
  characterSlot,
  setCharacterSlot,
  selectedFile,
  setSelectedFile,
  result,
  setResult,
  logs: _logs,
  setLogs,
  error,
  setError,
  isParsing,
  setIsParsing,
  clearCache,
}: SaveParserPageProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  async function parseFile(file: File, slot: CharacterSlot) {
    if (!isSupportedSaveFile(file)) {
      setSelectedFile(null);
      setResult(null);
      setLogs([]);
      setError(getUnsupportedFileMessage(file));
      setIsParsing(false);
      return;
    }

    setSelectedFile(file);
    setResult(null);
    setLogs([]);
    setError(null);
    setIsParsing(true);

    try {
      const parsed = await parseNightreignSaveFile(
        file,
        slot,
        (itemId) => {
          const relic = relicLookup.get(itemId);
          return relic ? { color: relic.color } : undefined;
        },
        (message) => setLogs((current) => [...current, message]),
      );

      setResult(parsed);
      setLogs(parsed.logs);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : String(parseError));
    } finally {
      setIsParsing(false);
    }
  }

  function handleFileUpload(file: File | undefined) {
    if (!file) return;
    void parseFile(file, characterSlot);
  }

  function handleUploadDrag(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setIsDragOver(true);
    }
    if (event.type === 'dragleave' || event.type === 'drop') {
      setIsDragOver(false);
    }
  }

  function handleUploadDrop(event: DragEvent<HTMLLabelElement>) {
    handleUploadDrag(event);
    handleFileUpload(event.dataTransfer.files[0]);
  }

  return (
    <section className="options-page save-parser-page" aria-labelledby="save-parser-title">
      <div className="options-page-heading">
        <div>
          <h2 id="save-parser-title">세이브 유물 분석</h2>
        </div>
        <span className="option-count">{result ? `${result.relics.length} relics` : 'ready'}</span>
      </div>

      <div className="save-parser-layout">
        <div className="calc-panel save-parser-controls">
          <label>
            캐릭터 슬롯
            <select
              value={characterSlot}
              onChange={(event) => {
                const nextSlot = Number(event.target.value) as CharacterSlot;
                setCharacterSlot(nextSlot);
                if (selectedFile) void parseFile(selectedFile, nextSlot);
              }}
            >
              {characterSlots.map((slot) => (
                <option key={slot} value={slot}>
                  Slot {slot}
                </option>
              ))}
            </select>
          </label>

          <label
            className={`save-upload-box${isDragOver ? ' is-drag-over' : ''}`}
            onDragEnter={handleUploadDrag}
            onDragOver={handleUploadDrag}
            onDragLeave={handleUploadDrag}
            onDrop={handleUploadDrop}
          >
            <input
              type="file"
              accept=".sl2,.co2,.dat"
              onChange={(event) => {
                handleFileUpload(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <strong>.sl2 / .co2 / .dat 업로드</strong>
            <span>
              {selectedFile
                ? `${selectedFile.name} (${formatBytes(selectedFile.size)})`
                : '파일을 선택하거나 여기로 끌어오면 바로 분석합니다.'}
            </span>
          </label>

          {selectedFile ? (
            <button
              type="button"
              className="relic-builder-reset"
              disabled={isParsing}
              onClick={() => void parseFile(selectedFile, characterSlot)}
            >
              다시 분석
            </button>
          ) : null}

          {result ? (
            <button
              type="button"
              className="relic-builder-reset"
              onClick={() => clearCache()}
            >
              결과 초기화
            </button>
          ) : null}

          {error ? <p className="save-parser-error">{error}</p> : null}
        </div>

        <div className="calc-panel save-parser-summary">
          <h3>분석 결과</h3>
          {isParsing ? <p className="muted-text">분석 중...</p> : null}
          {result ? (
            <>
              <div className="save-summary-grid">
                <div>
                  <span>캐릭터</span>
                  <strong>{result.characterInfo.name}</strong>
                </div>
                <div>
                  <span>Murks</span>
                  <strong>{result.characterInfo.murks.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Sigs</span>
                  <strong>{result.characterInfo.sigs.toLocaleString()}</strong>
                </div>
                <div>
                  <span>Steam ID 바이트</span>
                  <strong>{formatHex(result.characterInfo.steamId)}</strong>
                </div>
                <div>
                  <span>원본 슬롯</span>
                  <strong>{result.totalSlots}</strong>
                </div>
                <div>
                  <span>불확실</span>
                  <strong>
                    {result.uncertainSlots}
                    {result.uncertainResult ? ' / 결과 불확실' : ''}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <p className="muted-text">아직 분석된 파일이 없습니다.</p>
          )}
        </div>
      </div>

      {result ? (
        <div className="option-card-grid save-relic-grid">
          {result.relics.map((relic) => (
            <RelicResultCard key={relic.id} relic={relic} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default SaveParserPage;

import { useState, type Dispatch, type DragEvent, type SetStateAction } from 'react';
import ResponsiveSelect from '../components/ResponsiveSelect';
import { relicEffectsKo, relicItemColorMap, relics, relicRollAppData } from '../data/relics';
import type { RelicColor } from '../data/relics/types';
import { getRelicBorderClass, getRelicColorClass } from '../utils/relicColor';
import {
  parseNightreignSaveFile,
  type CharacterSlot,
  type ParsedRelic,
  type RelicScanResult,
} from '../utils/nightreignSaveParser';

// 캐릭터 슬롯과 지원 파일 형식
const characterSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const supportedSaveExtensions = ['.sl2', '.co2', '.dat'];

// 유물 번호로 이름과 색상 찾기
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

// 효과 번호로 옵션 정보 찾기
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

// 깊은 밤 디버프 정보 모으기
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

// 유물 색상 한글 이름
const relicColorNameMap: Record<RelicColor, string> = {
  Red: '빨강',
  Blue: '파랑',
  Yellow: '노랑',
  Green: '초록',
};

// 유물 이름에 붙는 색상 표현
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

type SaveRelicStats = {
  colorCounts: Record<RelicColor, number>;
  topOptions: Array<{ id: number; name: string; count: number }>;
  totalOptions: number;
  uniqueOptionCount: number;
  debuffRelicCount: number;
};

// 파일 크기 표시
function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

// 지원하는 세이브 파일 확인
function isSupportedSaveFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return supportedSaveExtensions.some((extension) => lowerName.endsWith(extension));
}

// 지원하지 않는 파일 안내
function getUnsupportedFileMessage(file: File) {
  return `${file.name}은 지원하지 않는 파일 형식입니다. .sl2, .co2, .dat 파일을 업로드해 주세요.`;
}

// 유물 이름 한글 표현 맞추기
function normalizeRelicName(name: string, color: RelicColor) {
  const colorAdjective = relicColorAdjectiveMap[color];
  let normalizedName = name.replace(relicNameColorWordPattern, colorAdjective);

  for (const [englishWord, koreanWord] of Object.entries(relicNameSizeWordMap)) {
    normalizedName = normalizedName.replace(new RegExp(`\\b${englishWord}\\b`, 'g'), koreanWord);
  }

  return normalizedName.replace(/\bScene\b/g, '풍경');
}

// 분석한 유물 이름 찾기
function getRelicName(relic: ParsedRelic) {
  const color = getRelicColor(relic);
  const name = relicLookup.get(relic.itemId)?.name ?? `알 수 없는 유물 ${relic.itemId}`;
  return normalizeRelicName(name, color);
}

// 분석한 유물 색상 찾기
function getRelicColor(relic: ParsedRelic): RelicColor {
  return relicLookup.get(relic.itemId)?.color ?? relic.color;
}

// 색상 한글 이름 찾기
function getColorName(color: RelicColor): string {
  return relicColorNameMap[color] || color;
}

// 비어있지 않은 효과 번호 확인
function isUsableEffectId(effectId: number) {
  return effectId !== emptyEffectId && effectId !== -1;
}

// 효과 번호를 표시 정보로 변환
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

// 유물의 버프와 디버프 묶기
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

// 분석한 유물 통계 계산
function getSaveRelicStats(parsedRelics: ParsedRelic[]): SaveRelicStats {
  const colorCounts: Record<RelicColor, number> = {
    Red: 0,
    Blue: 0,
    Yellow: 0,
    Green: 0,
  };
  const optionCounts = new Map<number, { id: number; name: string; count: number }>();
  let totalOptions = 0;
  let debuffRelicCount = 0;

  for (const relic of parsedRelics) {
    const color = getRelicColor(relic);
    colorCounts[color] += 1;

    const effectGroups = getRelicEffectGroups(relic);
    if (effectGroups.some((group) => group.debuff)) {
      debuffRelicCount += 1;
    }

    for (const group of effectGroups) {
      if (!group.buff) continue;

      const current = optionCounts.get(group.buff.id) ?? {
        id: group.buff.id,
        name: group.buff.name,
        count: 0,
      };
      current.count += 1;
      totalOptions += 1;
      optionCounts.set(group.buff.id, current);
    }
  }

  return {
    colorCounts,
    topOptions: [...optionCounts.values()].sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.name.localeCompare(right.name, 'ko');
    }),
    totalOptions,
    uniqueOptionCount: optionCounts.size,
    debuffRelicCount,
  };
}

// 분석 결과 유물 카드
function RelicResultCard({ relic }: { relic: ParsedRelic }) {
  const color = getRelicColor(relic);
  const effectGroups = getRelicEffectGroups(relic);

  return (
    <article className={`option-card save-relic-card ${getRelicBorderClass(String(color))}`}>
      <div className="option-card-header">
        <span className={`option-category ${getRelicColorClass(String(color))}`}>
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
                </>
              ) : null}
              {group.debuff ? (
                <div className="save-linked-debuff">
                  <span className="save-debuff-label">디버프</span>
                  <strong>{group.debuff.name}</strong>
                  {group.debuff.desc ? <p className="save-effect-desc">{group.debuff.desc}</p> : null}
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

// 세이브 분석 페이지 전체
function SaveParserPage({
  characterSlot,
  setCharacterSlot,
  selectedFile,
  setSelectedFile,
  result,
  setResult,
  setLogs,
  error,
  setError,
  isParsing,
  setIsParsing,
  clearCache,
}: SaveParserPageProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const saveStats = result ? getSaveRelicStats(result.relics) : null;

  // 세이브 파일 분석
  async function parseFile(file: File, slot: CharacterSlot) {
    // 파일 형식 먼저 확인
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
      // 선택한 캐릭터 슬롯의 유물 읽기
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

  // 선택한 파일 바로 분석
  function handleFileUpload(file: File | undefined) {
    if (!file) return;
    void parseFile(file, characterSlot);
  }

  // 파일 드래그 상태 표시
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

  // 끌어온 파일 분석
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

      {/* 파일과 캐릭터 슬롯 선택 */}
      <div className="save-parser-layout">
        <div className="calc-panel save-parser-controls">
          <label>
            캐릭터 슬롯
            <ResponsiveSelect
              value={String(characterSlot)}
              ariaLabel="캐릭터 슬롯"
              sheetTitle="캐릭터 슬롯 선택"
              options={characterSlots.map((slot) => ({
                value: String(slot),
                label: `Slot ${slot}`,
              }))}
              onChange={(nextCharacterSlot) => {
                const nextSlot = Number(nextCharacterSlot) as CharacterSlot;
                setCharacterSlot(nextSlot);
                if (selectedFile) void parseFile(selectedFile, nextSlot);
              }}
            />
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
            <span>
              세이브 파일은 서버에 저장되지 않습니다.
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

        {/* 유물 분석 통계 */}
        <div className="calc-panel save-parser-summary">
          <h3>분석 결과</h3>
          {isParsing ? <p className="muted-text">분석 중...</p> : null}
          {result ? (
            <>
              <div className="save-summary-grid">
                <div>
                  <span>전체 유물</span>
                  <strong>{result.relics.length.toLocaleString()}개</strong>
                </div>
                {saveStats
                  ? (Object.keys(relicColorNameMap) as RelicColor[]).map((color) => (
                      <div key={color}>
                        <span>{getColorName(color)} 유물</span>
                        <strong>{saveStats.colorCounts[color].toLocaleString()}개</strong>
                      </div>
                    ))
                  : null}
                {saveStats ? (
                  <>
                    <div>
                      <span>가장 많이 보유한 옵션</span>
                      <strong>{saveStats.topOptions[0]?.name ?? '옵션 없음'}</strong>
                    </div>
                    <div>
                      <span>옵션 종류</span>
                      <strong>{saveStats.uniqueOptionCount.toLocaleString()}종</strong>
                      <span>총 {saveStats.totalOptions.toLocaleString()}개 옵션</span>
                    </div>
                    <div>
                      <span>디버프 포함 유물</span>
                      <strong>{saveStats.debuffRelicCount.toLocaleString()}개</strong>
                    </div>
                  </>
                ) : null}
              </div>
              {saveStats?.topOptions.length ? (
                <div className="save-top-options">
                  <strong>보유 옵션 상위</strong>
                  {saveStats.topOptions.slice(0, 5).map((option, index) => (
                    <span key={option.id}>
                      {index + 1}. {option.name} <em>{option.count.toLocaleString()}개</em>
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted-text">아직 분석된 파일이 없습니다.</p>
          )}
        </div>
      </div>

      {/* 분석한 유물 카드 목록 */}
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

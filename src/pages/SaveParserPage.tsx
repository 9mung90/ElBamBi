import { useMemo, useState } from 'react';
import { relicEffectsKo, relicItemColorMap, relics } from '../data/relics';
import type { RelicColor } from '../data/relics/types';
import {
  parseNightreignSaveFile,
  type CharacterSlot,
  type ParsedRelic,
  type RelicScanResult,
} from '../utils/nightreignSaveParser';

const characterSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

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
    },
  ]),
);

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

function getRelicName(relic: ParsedRelic) {
  return relicLookup.get(relic.itemId)?.name ?? `Unknown relic ${relic.itemId}`;
}

function getRelicColor(relic: ParsedRelic): RelicColor {
  return relicLookup.get(relic.itemId)?.color ?? relic.color;
}

function RelicResultCard({ relic }: { relic: ParsedRelic }) {
  const color = getRelicColor(relic);

  return (
    <article className="option-card save-relic-card">
      <div className="option-card-header">
        <span className={`option-category relic-color-${String(color).toLowerCase()}`}>
          {color}
        </span>
        <span className="option-id">slot {relic.slotIndex}</span>
      </div>
      <h3>{getRelicName(relic)}</h3>
      <div className="save-relic-id-row">
        <span>itemId {relic.itemId}</span>
        <span>offset {relic.raw.offset}</span>
      </div>
      <div className="save-effect-list">
        {relic.effects.length ? (
          relic.effects.map((effectId) => {
            const effect = effectLookup.get(effectId);

            return (
              <div key={effectId} className="save-effect-item">
                <strong>{effect?.name ?? `Unknown effect ${effectId}`}</strong>
                <span>
                  {effectId}
                  {effect?.category ? ` / ${effect.category}` : ''}
                  {effect?.dn ? ' / dn' : ''}
                </span>
              </div>
            );
          })
        ) : (
          <p className="muted-text">효과 없음</p>
        )}
      </div>
    </article>
  );
}

function SaveParserPage() {
  const [characterSlot, setCharacterSlot] = useState<CharacterSlot>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<RelicScanResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const resultJson = useMemo(
    () => (result ? JSON.stringify(result.relics, null, 2) : ''),
    [result],
  );

  async function parseFile(file: File, slot: CharacterSlot) {
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

          <label className="save-upload-box">
            <input
              type="file"
              accept=".sl2,.co2,.dat"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void parseFile(file, characterSlot);
              }}
            />
            <strong>.sl2 / .co2 / .dat 업로드</strong>
            <span>
              {selectedFile
                ? `${selectedFile.name} (${formatBytes(selectedFile.size)})`
                : '파일을 선택하면 바로 분석합니다.'}
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
                  <span>Steam ID bytes</span>
                  <strong>{formatHex(result.characterInfo.steamId)}</strong>
                </div>
                <div>
                  <span>Raw slots</span>
                  <strong>{result.totalSlots}</strong>
                </div>
                <div>
                  <span>Uncertain</span>
                  <strong>
                    {result.uncertainSlots}
                    {result.uncertainResult ? ' / result uncertain' : ''}
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
        <>
          <div className="option-card-grid save-relic-grid">
            {result.relics.map((relic) => (
              <RelicResultCard key={relic.id} relic={relic} />
            ))}
          </div>

          <details className="calc-panel save-parser-details">
            <summary>JSON 출력</summary>
            <textarea value={resultJson} readOnly rows={12} />
          </details>
        </>
      ) : null}

      {logs.length ? (
        <details className="calc-panel save-parser-details">
          <summary>로그</summary>
          <pre>{logs.join('\n')}</pre>
        </details>
      ) : null}
    </section>
  );
}

export default SaveParserPage;

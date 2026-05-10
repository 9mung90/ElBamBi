import { useMemo, useState } from 'react';
import slotPositions from '../data/mapPatterns/slot_positions.json';
import mapPatterns from '../data/mapPatterns/mapPatterns.json';
import seedData from '../data/mapPatterns/seed_data.json';

interface SlotPosition {
  slot_name: string;
  x_percent: number;
  y_percent: number;
  x_px: number;
  y_px: number;
  building: string;
  icon_src: string;
  data_slot_id: string;
  style: string;
}

interface SlotPositionsFile {
  map_type: string;
  normal_slot_count: number;
  has_nightlord_position: boolean;
  map_rect: {
    width: number;
    height: number;
  };
  slots: Record<string, SlotPosition>;
}

interface MapPatternLocation {
  slot: string;
  category: string;
  location: string;
  value: string;
}

interface SeedRaw {
  seed_id: string;
  map_type: string;
  Event: string;
  nightlord: string;
  slots: Record<string, string>;
  hasOldGaol: boolean;
}

interface MapPatternData {
  id: number;
  sourceFile: string;
  nightlord: string;
  shiftingEarth: string;
  spawnPoint: string;
  specialEvent: string | null;
  night1Boss: string;
  night2Boss: string;
  extraNightBoss: string | null;
  night1Circle: string;
  night2Circle: string;
  rotBlessing: string | null;
  frenzyTower: string | null;
  scaleBearingMerchant: string | null;
  locations: MapPatternLocation[];
  seedInfo?: SeedRaw | null;
}

const MapPage = () => {
  const { map_rect, slots } = slotPositions as SlotPositionsFile;
  const patterns = (mapPatterns as MapPatternData[]).map((pattern) => ({
    ...pattern,
    seedInfo: null,
  }));

  const enrichedPatterns = useMemo(() => {
    const seedByPatternId = new Map<number, SeedRaw>();
    (seedData as SeedRaw[]).forEach((seed) => {
      const id = Number(seed.seed_id) + 1;
      seedByPatternId.set(id, seed);
    });

    return patterns.map((pattern) => ({
      ...pattern,
      seedInfo: seedByPatternId.get(pattern.id) ?? null,
    }));
  }, [patterns]);

  const mapTypeOptions = useMemo(() => {
    return Array.from(
      new Set(
        (enrichedPatterns as MapPatternData[])
          .map((pattern) => pattern.seedInfo?.map_type ?? '')
          .filter(Boolean),
      ),
    ).sort();
  }, [enrichedPatterns]);

  const nightlordOptions = useMemo(() => {
    return Array.from(new Set(enrichedPatterns.map((pattern) => pattern.nightlord))).sort();
  }, [enrichedPatterns]);

  const [selectedMapType, setSelectedMapType] = useState<string>('');
  const [selectedNightlord, setSelectedNightlord] = useState<string>('');
  const [selectedSlots, setSelectedSlots] = useState<Record<string, string>>({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);

  const slotNameToId = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(slots).forEach(([slotId, slotData]) => {
      map[slotData.slot_name] = slotId;
    });
    return map;
  }, [slots]);

  const filteredPatterns = useMemo(() => {
    return enrichedPatterns.filter((pattern) => {
      if (selectedMapType && pattern.seedInfo?.map_type !== selectedMapType) {
        return false;
      }
      if (selectedNightlord && pattern.nightlord !== selectedNightlord) {
        return false;
      }
      return true;
    });
  }, [enrichedPatterns, selectedMapType, selectedNightlord]);

  const matchingPatterns = useMemo(() => {
    return filteredPatterns.filter((pattern) => {
      return Object.entries(selectedSlots).every(([slotId, value]) => {
        const slotName = slots[slotId]?.slot_name;
        if (!slotName) {
          return false;
        }
        return pattern.locations.some((location) => location.slot === slotName && location.value === value);
      });
    });
  }, [filteredPatterns, selectedSlots, slots]);

  const slotPossibilities = useMemo(() => {
    const possibilities: Record<string, Set<string>> = {};

    matchingPatterns.forEach((pattern) => {
      pattern.locations.forEach((location) => {
        const slotId = slotNameToId[location.slot];
        if (!slotId) {
          return;
        }
        if (!possibilities[slotId]) {
          possibilities[slotId] = new Set();
        }
        possibilities[slotId].add(location.value);
      });
    });

    const result: Record<string, string[]> = {};
    Object.keys(possibilities).forEach((slotId) => {
      result[slotId] = Array.from(possibilities[slotId]).sort();
    });
    return result;
  }, [matchingPatterns, slotNameToId]);

  const handleSlotClick = (slotId: string) => {
    setActiveSlot((current) => (current === slotId ? null : slotId));
  };

  const handleValueSelect = (slotId: string, value: string) => {
    setSelectedSlots((prev) => ({
      ...prev,
      [slotId]: value,
    }));
    setActiveSlot(null);
  };

  const handleClearSlot = (slotId: string) => {
    setSelectedSlots((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  };

  const selectedSeed = matchingPatterns.length === 1 ? matchingPatterns[0] : null;

  return (
    <div style={{ padding: '20px', color: 'var(--night-text)' }}>
      <h1>맵 식별 도구</h1>

      <section style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
          <div style={{ minWidth: '240px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>맵 타입 선택</label>
            <select
              value={selectedMapType}
              onChange={(event) => setSelectedMapType(event.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--night-border)', backgroundColor: 'var(--night-input)', color: 'var(--night-text)' }}
            >
              <option value="">전체 맵 타입</option>
              {mapTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '240px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Nightlord 선택</label>
            <select
              value={selectedNightlord}
              onChange={(event) => setSelectedNightlord(event.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--night-border)', backgroundColor: 'var(--night-input)', color: 'var(--night-text)' }}
            >
              <option value="">전체 Nightlord</option>
              {nightlordOptions.map((nightlord) => (
                <option key={nightlord} value={nightlord}>
                  {nightlord}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ marginTop: '12px', color: 'var(--night-muted)' }}>
          맵 타입과 Nightlord를 먼저 선택한 후 거점을 고르세요. 불가능한 거점 값은 후보가 좁혀지면 자동으로 제외됩니다.
        </p>
      </section>

      <section style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ width: '560px', minWidth: '560px' }}>
          <div
            style={{
              position: 'relative',
              width: `${map_rect.width}px`,
              height: `${map_rect.height}px`,
              backgroundColor: 'var(--night-bg-deep)',
              border: '2px solid var(--night-border-strong)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {Object.entries(slots).map(([slotId, slot]) => {
              const isSelected = Boolean(selectedSlots[slotId]);
              const isActive = activeSlot === slotId;
              return (
                <button
                  key={slotId}
                  type="button"
                  onClick={() => handleSlotClick(slotId)}
                  style={{
                    position: 'absolute',
                    left: `${slot.x_px}px`,
                    top: `${slot.y_px}px`,
                    transform: 'translate(-50%, -50%)',
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    border: isActive ? '2px solid var(--night-accent-bright)' : '1px solid var(--night-border)',
                    backgroundColor: isSelected ? 'var(--night-green-bg)' : 'rgba(17, 26, 48, 0.92)',
                    cursor: 'pointer',
                    color: 'var(--night-text)',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'center',
                    lineHeight: '1.2',
                  }}
                  title={slot.slot_name}
                >
                  {slotId}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {Object.entries(selectedSlots).map(([slotId, value]) => (
              <div
                key={slotId}
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--night-accent-bg)',
                  color: 'var(--night-text)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span>
                  {slotId}: {value}
                </span>
                <button
                  type="button"
                  onClick={() => handleClearSlot(slotId)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--night-text)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '360px' }}>
          <div style={{ marginBottom: '20px', padding: '18px', borderRadius: '10px', backgroundColor: 'var(--night-surface)', border: '1px solid var(--night-border-soft)' }}>
            <h2 style={{ margin: '0 0 12px' }}>거점 선택</h2>
            {activeSlot ? (
              <>
                <p style={{ margin: '0 0 12px' }}>
                  Slot {activeSlot}: {slots[activeSlot]?.slot_name}
                </p>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {(slotPossibilities[activeSlot] || []).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleValueSelect(activeSlot, value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        textAlign: 'left',
                        borderRadius: '8px',
                        border: '1px solid var(--night-border)',
                        backgroundColor: 'var(--night-surface-2)',
                        color: 'var(--night-text)',
                        cursor: 'pointer',
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: 'var(--night-text-soft)' }}>맵에서 슬롯을 누르면 가능한 거점 목록이 나타납니다.</p>
            )}
          </div>

          <div style={{ padding: '18px', borderRadius: '10px', backgroundColor: 'var(--night-surface-2)', border: '1px solid var(--night-border-soft)' }}>
            <h2 style={{ margin: '0 0 12px' }}>가능한 시드</h2>
            <p style={{ margin: '0 0 14px', color: 'var(--night-text-soft)' }}>
              선택한 맵과 보스, 거점 조건을 만족하는 후보 시드 수: <strong>{matchingPatterns.length}</strong>
            </p>
            {matchingPatterns.length > 0 ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                {matchingPatterns.slice(0, 10).map((pattern) => (
                  <div
                    key={pattern.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: selectedSeed?.id === pattern.id ? '2px solid var(--night-accent-bright)' : '1px solid var(--night-border-soft)',
                      backgroundColor: 'var(--night-surface-2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <strong>seed {pattern.seedInfo?.seed_id ?? 'unknown'}</strong>
                      <span style={{ color: 'var(--night-text-soft)' }}>{pattern.sourceFile}</span>
                    </div>
                    <p style={{ margin: '8px 0 0' }}>
                      <strong>Nightlord:</strong> {pattern.nightlord}
                    </p>
                    <p style={{ margin: '6px 0 0' }}>
                      <strong>Night 1 Boss:</strong> {pattern.night1Boss}
                    </p>
                    <p style={{ margin: '6px 0 0' }}>
                      <strong>Night 2 Boss:</strong> {pattern.night2Boss}
                    </p>
                    {pattern.seedInfo && (
                      <p style={{ margin: '6px 0 0', color: 'var(--night-text-soft)' }}>
                        Event: {pattern.seedInfo.Event || '없음'} / OldGaol: {pattern.seedInfo.hasOldGaol ? '있음' : '없음'}
                      </p>
                    )}
                  </div>
                ))}
                {matchingPatterns.length > 10 && (
                  <p style={{ margin: '0', color: 'var(--night-text-soft)' }}>처음 10개만 표시됩니다. 더 좁혀주세요.</p>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, color: 'var(--night-text-soft)' }}>조건에 맞는 시드가 없습니다.</p>
            )}
          </div>

          {selectedSeed && (
            <div style={{ marginTop: '20px', padding: '18px', borderRadius: '10px', backgroundColor: 'var(--night-accent-bg)', border: '1px solid var(--night-border-strong)' }}>
              <h2 style={{ margin: '0 0 12px' }}>확정된 시드</h2>
              <p style={{ margin: '0 0 8px' }}><strong>seed {selectedSeed.seedInfo?.seed_id}</strong> ({selectedSeed.sourceFile})</p>
              <p style={{ margin: '0 0 6px' }}><strong>Nightlord:</strong> {selectedSeed.nightlord}</p>
              <p style={{ margin: '0 0 6px' }}><strong>Spawn Point:</strong> {selectedSeed.spawnPoint}</p>
              <p style={{ margin: 0 }}><strong>Night 1 Boss:</strong> {selectedSeed.night1Boss}, <strong>Night 2 Boss:</strong> {selectedSeed.night2Boss}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default MapPage;

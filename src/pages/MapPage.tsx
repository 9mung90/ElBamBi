import { useMemo, useState } from 'react';
import slotPositions from '../data/mapPatterns/slot_positions.json';
import seedData from '../data/mapPatterns/seed_data.json';

const mapImages = import.meta.glob('../assets/images/map/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

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

interface SeedData {
  seed_id: string;
  map_type: string;
  Event: string;
  nightlord: string;
  slots: Record<string, string>;
  hasOldGaol: boolean;
}

const MapPage = () => {
  const { map_rect, slots } = slotPositions as SlotPositionsFile;
  const seeds = (seedData as SeedData[]);

  const mapTypeOptions = useMemo(() => {
    return Array.from(new Set(seeds.map((seed) => seed.map_type))).sort();
  }, []);

  const nightlordOptions = useMemo(() => {
    return Array.from(new Set(seeds.map((seed) => seed.nightlord))).sort();
  }, []);

  const [selectedMapType, setSelectedMapType] = useState<string>('Normal');
  const [selectedNightlord, setSelectedNightlord] = useState<string>('');
  const [selectedSlots, setSelectedSlots] = useState<Record<string, string>>({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);

  const filteredSeeds = useMemo(() => {
    return seeds.filter((seed) => {
      if (seed.map_type !== selectedMapType) {
        return false;
      }
      if (selectedNightlord && seed.nightlord !== selectedNightlord) {
        return false;
      }
      return true;
    });
  }, [selectedMapType, selectedNightlord]);

  const matchingSeeds = useMemo(() => {
    return filteredSeeds.filter((seed) => {
      return Object.entries(selectedSlots).every(([slotId, value]) => {
        return seed.slots[slotId] === value;
      });
    });
  }, [filteredSeeds, selectedSlots]);

  const slotPossibilities = useMemo(() => {
    const possibilities: Record<string, Set<string>> = {};

    matchingSeeds.forEach((seed) => {
      Object.entries(seed.slots).forEach(([slotId, value]) => {
        if (!value) return;
        if (!possibilities[slotId]) {
          possibilities[slotId] = new Set();
        }
        possibilities[slotId].add(value);
      });
    });

    const result: Record<string, string[]> = {};
    Object.keys(possibilities).forEach((slotId) => {
      result[slotId] = Array.from(possibilities[slotId]).sort();
    });
    return result;
  }, [matchingSeeds]);

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

  const selectedSeed = matchingSeeds.length === 1 ? matchingSeeds[0] : null;

  const getMapImageUrl = (mapType: string) => {
    const normalizedName = mapType
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    const matchedPath = Object.keys(mapImages).find(
      (path) => path.toLowerCase().includes(normalizedName.toLowerCase()),
    );

    return matchedPath ? mapImages[matchedPath] : null;
  };

  const mapImageUrl = getMapImageUrl(selectedMapType);

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
              backgroundImage: mapImageUrl ? `url('${mapImageUrl}')` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
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
              조건을 만족하는 후보 시드 수: <strong>{matchingSeeds.length}</strong>
            </p>
            {matchingSeeds.length > 0 ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                {matchingSeeds.slice(0, 10).map((seed) => (
                  <div
                    key={seed.seed_id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: selectedSeed?.seed_id === seed.seed_id ? '2px solid var(--night-accent-bright)' : '1px solid var(--night-border-soft)',
                      backgroundColor: 'var(--night-surface-2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                      <strong>seed {seed.seed_id}</strong>
                      <span style={{ color: 'var(--night-text-soft)', fontSize: '12px' }}>{seed.map_type}</span>
                    </div>
                    <p style={{ margin: '8px 0 0' }}>
                      <strong>Nightlord:</strong> {seed.nightlord}
                    </p>
                    <p style={{ margin: '6px 0 0', color: 'var(--night-text-soft)' }}>
                      Event: {seed.Event || '없음'} / OldGaol: {seed.hasOldGaol ? '있음' : '없음'}
                    </p>
                  </div>
                ))}
                {matchingSeeds.length > 10 && (
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
              <p style={{ margin: '0 0 8px' }}><strong>seed {selectedSeed.seed_id}</strong></p>
              <p style={{ margin: '0 0 6px' }}><strong>Map Type:</strong> {selectedSeed.map_type}</p>
              <p style={{ margin: '0 0 6px' }}><strong>Nightlord:</strong> {selectedSeed.nightlord}</p>
              <p style={{ margin: 0 }}><strong>Event:</strong> {selectedSeed.Event || '없음'} / <strong>OldGaol:</strong> {selectedSeed.hasOldGaol ? '있음' : '없음'}</p>
              {/* 여기에 완성된 맵 이미지를 표시할 예정 */}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default MapPage;

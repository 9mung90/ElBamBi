import { useMemo } from 'react';
import { vessels, type Vessel } from '../data/vessels';

// 구분자로 이어진 목록 나누기
function splitList(value: string) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

// 색상 목록 한글로 나누기
function splitColors(value: string) {
  return value
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean);
}

// 검색 함수
function matchesVesselSearch(vessel: Vessel, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  // 검색어가 없으면 전체 표시
  if (!normalizedQuery) return true;

  // 이름과 캐릭터 및 색상에서 검색
  return [
    vessel.index,
    vessel.name,
    vessel.character,
    vessel.relicColors,
    vessel.deepRelicColors,
    vessel.isDefault,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

// 유물 색상 슬롯
function RelicColorSlots({
  label,
  colors,
  imageUrls,
}: {
  label: string;
  colors: string;
  imageUrls: string;
}) {
  const colorNames = splitColors(colors);
  const colorImages = splitList(imageUrls);

  // 색상 이름과 이미지 순서 맞추기
  return (
    <div className="vessel-color-row">
      <span className="vessel-color-label">{label}</span>
      <div className="vessel-color-slots" aria-label={`${label}: ${colors}`}>
        {colorImages.map((imageUrl, index) => {
          const color = colorNames[index] ?? `slot-${index + 1}`;

          return (
            <img
              key={`${color}-${index}`}
              className="vessel-color-slot-image"
              src={imageUrl}
              alt={color}
              loading="lazy"
              title={color}
            />
          );
        })}
      </div>
    </div>
  );
}

// 그릇 카드
function VesselCard({ vessel }: { vessel: Vessel }) {
  const vesselImages = splitList(vessel.nameImages);
  const characterImages = splitList(vessel.characterImages);
  const isDefault = vessel.isDefault.toLowerCase() === 'yes';

  // 그릇과 캐릭터 및 슬롯 정보 표시
  return (
    <article className="option-card vessel-card">
      <div className="vessel-card-main">
        {vesselImages[0] ? (
          <img className="vessel-image" src={vesselImages[0]} alt="" loading="lazy" />
        ) : null}
        <div className="vessel-card-title">
          <div className="option-card-header">
            <span className="option-category">{vessel.character}</span>
            {isDefault ? <span className="vessel-default-badge">기본</span> : null}
          </div>
          <h3>{vessel.name}</h3>
        </div>
        {characterImages[0] ? (
          <img className="vessel-character-image" src={characterImages[0]} alt="" loading="lazy" />
        ) : null}
      </div>

      <div className="vessel-color-section">
        <RelicColorSlots
          label="일반"
          colors={vessel.relicColors}
          imageUrls={vessel.relicColorImageUrls}
        />
        <RelicColorSlots
          label="깊은 밤"
          colors={vessel.deepRelicColors}
          imageUrls={vessel.deepRelicColorImageUrls}
        />
      </div>
    </article>
  );
}

// 그릇 페이지 전체
function VesselsPage({ searchQuery }: { searchQuery: string }) {
  // 검색 조건에 맞는 그릇 목록
  const filteredVessels = useMemo(
    () => vessels.filter((vessel) => matchesVesselSearch(vessel, searchQuery)),
    [searchQuery],
  );

  return (
    <section className="options-page" aria-labelledby="vessels-title">
      <div className="options-page-heading">
        <div>
          <h2 id="vessels-title">현기</h2>
        </div>
        <span className="option-count">
          {filteredVessels.length} / {vessels.length}
        </span>
      </div>

      {/* 그릇 카드 목록 */}
      <div className="option-card-grid">
        {filteredVessels.map((vessel) => (
          <VesselCard key={vessel.index} vessel={vessel} />
        ))}
      </div>
    </section>
  );
}

export default VesselsPage;

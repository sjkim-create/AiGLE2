/**
 * CradleImage — 크래들 1대를 실물 이미지로 그린다 (시안)
 *
 * 크래들 사진(1731×740)을 원본 비율 그대로 폭에 맞춰 늘이고 줄인다. 슬롯 10칸은 사진 속 번호 위치를
 * 비율(%)로 잡아 투명 버튼을 얹으므로 크기가 바뀌어도 어긋나지 않는다. 펜은 LED가 꺼진 이미지 한 장에
 * LED 색만 코드로 얹는다 — 상태 색(정상 · 확인 필요 · 미분류 · 읽지 않음 · 연결 중 …)을 이미지 한 장으로 표현.
 * 최소 폭 아래로는 줄지 않는다.
 *
 * slots: [{ slot, pen, available, picked, led: '#22C55E', linking, title, ariaLabel, onClick, below }]
 */
import React from 'react';

const BASE = `${import.meta.env.BASE_URL}images/cradle/`;
/* 원본(디자인팀) 파일 — 크래들 Z100 · 펜 F45(LED 꺼짐). 크래들 PNG(약 960KB)는 웹용 WebP로 바꿔 쓴다 */
const CRADLE_IMG = '261001-F45-Z100-conn_Z100.webp';
const PEN_OFF_IMG = '261001-F45-Z100-conn_F45-off.png';
const IMG_W = 1731;
const IMG_H = 740;
/* 사진에서 잰 값 — 슬롯 1 중심 239px, 간격 139.4px */
const SLOT_X0 = (239 / IMG_W) * 100;
const SLOT_DX = (139.4 / IMG_W) * 100;
const PEN_W = 4.9;          // 펜 폭(크래들 폭 대비 %)
const PEN_TOP = 52;         // 펜 머리 위치(크래들 높이 대비 %)
const SLOT_TOP = 46;        // 누를 수 있는 슬롯 영역 시작(%)
export const CRADLE_MIN_W = 360;
export const CRADLE_MAX_W = 560;

const CradleImage = ({ slots, header }) => (
  /* 세 대가 같은 폭 — 한 줄에 3대가 들어가면 1/3씩, 좁으면 최소 폭으로 줄바꿈(외톨이가 커지지 않게) */
  <div style={{ flex: '0 0 auto', width: `clamp(${CRADLE_MIN_W}px, calc((100% - 28px) / 3), ${CRADLE_MAX_W}px)` }}>
    <style>{'@keyframes penLinking { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } } .cradle-slot-empty:hover { background: rgba(255,255,255,0.10) !important; }'}</style>
    {header}
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${IMG_W} / ${IMG_H}`, backgroundImage: `url(${BASE}${CRADLE_IMG})`, backgroundSize: '100% 100%', borderRadius: '6% / 14%', overflow: 'hidden' }}>
      {slots.map((s, i) => {
        const left = `${SLOT_X0 + i * SLOT_DX}%`;
        return (
          <React.Fragment key={s.slot}>
            {s.pen && (
              <div style={{ position: 'absolute', left, top: `${PEN_TOP}%`, width: `${PEN_W}%`, transform: 'translateX(-50%)', pointerEvents: 'none', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))' }}>
                <img src={`${BASE}${PEN_OFF_IMG}`} alt="" draggable={false} style={{ display: 'block', width: '100%' }} />
                {/* LED — 펜 이미지(97×362)의 LED 자리(가로 50% · 세로 24%)에 상태 색을 켠다 */}
                <span style={{ position: 'absolute', left: '50%', top: '24%', width: '19%', aspectRatio: '1', transform: 'translate(-50%,-50%)', borderRadius: '22%', background: s.led || '#22C55E', boxShadow: `0 0 6px 1px ${s.led || '#22C55E'}`, animation: s.linking ? 'penLinking 1s ease-in-out infinite' : 'none' }} />
              </div>
            )}
            <button type="button" onClick={s.onClick} disabled={!s.pen && !s.available} title={s.title} aria-label={s.ariaLabel}
              style={{ position: 'absolute', left, top: `${SLOT_TOP}%`, bottom: 0, width: `${SLOT_DX * 0.86}%`, transform: 'translateX(-50%)', padding: 0, background: 'transparent', cursor: (s.pen || s.available) ? 'pointer' : 'default',
                border: s.picked ? '2px solid #60A5FA' : '2px solid transparent', borderRadius: 6, boxShadow: s.picked ? '0 0 0 3px rgba(96,165,250,0.35)' : 'none' }}
              className={!s.pen && s.available ? 'cradle-slot-empty' : undefined}>
              {/* 빈 슬롯은 원본 이미지의 네모 표시를 그대로 보인다 — 「＋」를 얹지 않는다. 거치 가능하면 마우스를 올렸을 때만 옅게 강조 */}
            </button>
          </React.Fragment>
        );
      })}
    </div>
    {/* 슬롯 아래 라벨 줄 — 사진과 같은 비율 위치 */}
    <div style={{ position: 'relative', height: 24, marginTop: 4 }}>
      {slots.map((s, i) => s.below ? (
        <div key={s.slot} style={{ position: 'absolute', left: `${SLOT_X0 + i * SLOT_DX}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{s.below}</div>
      ) : null)}
    </div>
  </div>
);

export default CradleImage;

/**
 * teacherInk.js — 교사 첨삭(교사펜) 저장 · 공유 (SCR-03 원본 보기 · TSK-10 학생 결과 · POP-19 리포트 공용 · 로컬 프로토 코드)
 *
 * 교사가 교사펜으로 학생 종이 답안지 위에 쓴 필기를 학생 답안과 같은 Ncode 좌표로 저장한다.
 *   · 학생 · 문항마다 { visible, strokes: [{ color, bold, p: [[x, y], …] }] }
 *   · visible = false(숨김)이면 학생 화면 · 리포트에 싣지 않는다(교사 화면에서만 숨김 표시)
 * 프로토: 브라우저 저장(localStorage) + 같은 화면의 다른 곳에 바로 알린다(이벤트).
 * 상용: 서버에 학생 답안과 함께 저장. 교사펜 실시간 연결(BLE · USB 연결 앱)은 펜 에뮬레이터 자리에 붙인다.
 */
import { useEffect, useState } from 'react';

/* 첨삭 색상 — 블루 · 빨강 (회색은 2026-10-19 삭제) */
export const INK_COLORS = [
  { id: 'blue', label: '블루', hex: '#2563EB' },
  { id: 'red', label: '빨강', hex: '#DC2626' },
];
const LEGACY_HEX = { gray: '#6B7280' }; // 회색 삭제 전에 쓴 첨삭은 그 색 그대로 보인다
export const inkHex = (id) => INK_COLORS.find((c) => c.id === id)?.hex || LEGACY_HEX[id] || INK_COLORS[1].hex;
export const INK_WIDTH = { normal: 0.5, bold: 1.0 }; // Ncode 단위(학생 필기 0.38보다 조금 굵게)

const STORE = 'aigle.teacherInk.v1';
const EVT = 'aigle:teacher-ink';
const EMPTY = { visible: true, strokes: [] };

/* 학생 이름 + 문항 원문 — 교사 채점 화면과 학생 결과 화면이 같은 키를 쓴다 */
export const inkKey = (studentName, qText) => `${studentName || ''}|${qText || ''}`;

const readAll = () => {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; }
};
export const getInk = (key) => ({ ...EMPTY, ...(readAll()[key] || {}) });
export const setInk = (key, next) => {
  const all = readAll();
  all[key] = next;
  try { localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* 저장 불가 — 이번 화면에서만 */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
};

/* 첨삭 읽기 · 고치기 — 다른 화면(학생 결과 · 리포트 미리보기)에서 바뀌어도 바로 따라간다 */
export const useInk = (key) => {
  const [ink, setLocal] = useState(() => getInk(key));
  useEffect(() => {
    setLocal(getInk(key));
    const on = (e) => { if (!e.detail || e.detail === key) setLocal(getInk(key)); };
    const onStorage = (e) => { if (e.key === STORE) setLocal(getInk(key)); };
    window.addEventListener(EVT, on);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener('storage', onStorage); };
  }, [key]);
  const update = (fn) => setInk(key, fn(getInk(key)));
  return [ink, update];
};

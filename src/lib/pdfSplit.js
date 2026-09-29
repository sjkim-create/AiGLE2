/**
 * pdfSplit.js — 일괄 스캔 PDF를 쪽마다 JPG로 나눈다 (브라우저 안에서만 처리)
 *
 * [SCR-05 v4.10] ScanGradingModal의 페이지 분리와 같은 규칙. 일괄 채점 통합 화면(BatchGradingUnified)이 쓴다.
 *   · 렌더 intent 'print' — 기본(display)은 requestAnimationFrame에 묶여 탭이 가려지면 멈춘다
 *   · 빈 페이지 추정 — 작게 줄여 어두운 픽셀 비율을 본다 (양면 스캔의 빈 뒷면 기본 제외용)
 */
import * as pdfjsLib from 'pdfjs-dist';

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export const SPLIT_RENDER_W = 1600; // 쪽 이미지 가로 픽셀 — 학생정보 손글씨 OCR이 가능한 해상도
export const BLANK_RATIO = 0.004;   // 어두운 픽셀 비율이 이보다 낮으면 빈 페이지

const looksBlank = (canvas) => {
  const w = 60; const h = Math.max(1, Math.round((canvas.height / canvas.width) * w));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) < 200) dark += 1;
  }
  return dark / (w * h) < BLANK_RATIO;
};

/** PDF 쪽 수만 읽는다 — 1쪽이면 나눌 필요가 없다 */
export const openPdf = async (file) => pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;

/**
 * 쪽마다 JPG로 렌더한다.
 * @param doc       openPdf 결과
 * @param stem      파일 이름 앞부분 (확장자 제외)
 * @param onPage    ({ no, name, file, url, size, blank }) => void — 한 쪽 끝날 때마다
 * @param isCancelled () => boolean — 교사가 [분리 취소]했으면 true
 */
export const renderPages = async (doc, stem, onPage, isCancelled = () => false) => {
  for (let p = 1; p <= doc.numPages; p += 1) {
    if (isCancelled()) return false;
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, SPLIT_RENDER_W / base.width) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas, intent: 'print' }).promise;
    const blank = looksBlank(canvas);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    const name = `${stem}_p${String(p).padStart(2, '0')}.jpg`;
    onPage({ no: p, name, file: new File([blob], name, { type: 'image/jpeg' }), url: URL.createObjectURL(blob), size: blob.size, blank });
  }
  return true;
};

/** 분리 실패 사유 — 교사가 할 일까지 말한다 */
export const splitErrorReason = (err) => (err?.name === 'PasswordException'
  ? '암호가 걸린 PDF라 페이지를 나눌 수 없습니다. 암호를 풀고 다시 올려 주세요.'
  : '파일을 열 수 없습니다 (손상된 PDF). 다시 저장하거나 스캔해 주세요.');

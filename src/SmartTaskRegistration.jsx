/**
 * SmartTaskRegistration — 새 과제 등록 › ✨ 스마트 과제 등록 (TSK-14)
 *
 * 평가 자료(PDF·이미지)를 올려 AI로 과제를 만든다. 먼저 「무슨 답안지로 볼 과제인가」를 고른다.
 *   · 서·논술형 — 문항별 답안지 · AI 채점 기준(루브릭) 채점 → 자료를 바로 서·논술 과제로 등록 (TaskFileGenerate)
 *                서·논술 문항은 과제 안에만 있고 문제 은행에 들어가지 않는다
 *   · 정답형   — 이 화면에서 문항을 만들지 않는다. 문항은 문제 은행(QBK-01)에서 자료를 올려 모으고,
 *                「과제 배치」(준비 중)에서 문제 은행 문항을 골라 정답형 과제(시험지)를 만든다 → 여기서는 안내와 이동만
 * [v1.2] 문항(문제 은행)과 과제(과제 관리)를 나눈다 — 정답형 문항 추출은 문제 은행 안으로 옮김
 * 같은 서술형 문항이라도 시험지 안에 들어가면 정답형 과제의 일부가 되므로, 분기는 문항 유형이 아니라 교사가 고른다.
 */
import React, { useState } from 'react';
import TaskFileGenerate from './TaskFileGenerate';

const Crumb = ({ path }) => (
  <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700, marginBottom: 2 }}>{path.join(' › ')}</div>
);


const KINDS = {
  essay: {
    icon: '📝', title: '서·논술형', color: '#7C3AED', bg: '#F5F3FF',
    summary: '문항별 답안지에 서술하고, 채점 기준표(루브릭)로 AI가 채점합니다.',
    points: ['자료를 읽어 바로 서·논술 과제로 등록', '문항·모범답안·채점 기준·성취기준 자동 입력', '과제당 문항 최대 3개 · 문항은 문제 은행에 들어가지 않음'],
  },
  answer: {
    icon: '✅', title: '정답형', color: '#2A75F3', bg: '#EFF6FF',
    summary: '선다형·진위형·단답형처럼 정답이 정해진 문항으로 시험지 과제를 만듭니다. 문제와 답안 칸이 한 장입니다.',
    points: ['자료를 읽어 문항 분류·정답·배점·과제명까지 자동 입력', '확인·배치 후 정답형 과제로 등록', '가져온 문항은 문제 은행에도 저장 (선택)'],
  },
};

// onGoItemBank(view) — 'import'면 문제 은행의 「자료에서 문항 가져오기」로, 아니면 문제 은행 목록으로
// onStartAnswer — 정답형을 고르면 정답형 과제 만들기(TSK-15) 스마트로 바로 (자료 → 문항 → 배치 → 저장, 과제 관리 안)
const SmartTaskRegistration = ({ onBack, onAdd, onGoItemBank, onStartAnswer, initialKind = null }) => {
  const [kind, setKind] = useState(initialKind); // null | 'essay' | 'answer'

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', fontFamily: 'inherit' }}>← 과제 목록</button>
        <div>
          <Crumb path={['과제 관리', '과제 목록', '새 과제 등록']} />
          <h1 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, margin: 0 }}>✨ 스마트 과제 등록</h1>
        </div>
        {kind && (
          <>
            <span style={{ padding: '4px 12px', borderRadius: 999, background: KINDS[kind].bg, color: KINDS[kind].color, fontWeight: 800, fontSize: 'var(--neo-font-size-sm)' }}>{KINDS[kind].icon} {KINDS[kind].title}</span>
            <button onClick={() => setKind(null)} title="진행 중인 내용은 사라집니다"
              style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: '#64748B', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit', textDecoration: 'underline' }}>과제 형태 다시 고르기</button>
          </>
        )}
      </header>

      <div style={{ flex: 1, padding: '32px 16px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: kind === 'answer' ? 960 : 760 }}>
          {!kind && (
            <>
              <h2 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, textAlign: 'center', margin: '8px 0 6px' }}>어떤 과제를 만드시겠어요?</h2>
              <p style={{ fontSize: 'var(--neo-font-size-base)', color: '#64748B', textAlign: 'center', margin: '0 0 28px' }}>
                평가 자료(PDF·이미지)를 올리면 AI가 내용을 읽어 과제로 만듭니다. 학생이 답을 쓰는 방식에 맞춰 골라 주세요.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {Object.entries(KINDS).map(([k, v]) => (
                  <button key={k} onClick={() => (k === 'answer' && onStartAnswer ? onStartAnswer() : setKind(k))}
                    style={{ textAlign: 'left', background: 'white', border: '2px solid #E2E8F0', borderRadius: 16, padding: '24px 22px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = v.color; e.currentTarget.style.background = v.bg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = 'white'; }}>
                    <span style={{ fontSize: '2.4rem', lineHeight: 1 }}>{v.icon}</span>
                    <span style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, color: '#1E293B' }}>{v.title}</span>
                    <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', lineHeight: 1.6 }}>{v.summary}</span>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 'var(--neo-font-size-sm)', color: '#64748B', lineHeight: 1.7 }}>
                      {v.points.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', textAlign: 'center', marginTop: 18 }}>
                서술형 문항이 섞인 시험지도 한 장으로 볼 거라면 <b>정답형</b>을 고르세요. 시험지 안의 서술형은 문제 은행 문항이고, 서·논술 과제의 문항과는 따로 관리합니다.
              </p>
            </>
          )}
          {kind === 'essay' && <TaskFileGenerate embedded onBack={onBack} onAdd={onAdd} />}
          {kind === 'answer' && (
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: 0 }}>정답형 과제는 문제 은행의 문항으로 만듭니다</h2>
              <p style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', margin: 0, lineHeight: 1.7 }}>
                정답형 문항은 여러 시험지에 다시 쓰는 단위라 <b>문제 은행</b>에 모아 둡니다. 서·논술 과제의 문항과는 따로 관리합니다.
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--neo-font-size-sm)', color: '#334155', lineHeight: 1.9 }}>
                <li><b>문제 은행 › 자료에서 문항 가져오기</b> — 시험지·교재 PDF를 올려 문항을 유형별로 모읍니다</li>
                <li><b>문제 은행</b> — 문항을 고치고 문제집으로 엮습니다</li>
                <li><b>과제 배치</b> (준비 중) — 문항·문제집을 골라 시험지 과제를 만들고 Ncode로 출력해 채점합니다</li>
              </ol>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {onGoItemBank && <button onClick={() => onGoItemBank('list')} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }}>문제 은행으로 이동</button>}
                {onGoItemBank && <button onClick={() => onGoItemBank('import')} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #2A75F3', background: '#2A75F3', color: 'white', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--neo-font-size-sm)' }}>📥 자료에서 문항 가져오기</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartTaskRegistration;

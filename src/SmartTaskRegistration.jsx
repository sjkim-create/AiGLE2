/**
 * SmartTaskRegistration — 새 과제 등록 › ✨ 스마트 과제 등록 (TSK-14)
 *
 * 평가 자료(PDF·이미지)를 올려 AI로 과제를 만든다. 먼저 「무슨 답안지로 볼 과제인가」를 고른다.
 *   · 서·논술형 — 문항별 답안지 · AI 채점 기준(루브릭) 채점 → 자료를 바로 서·논술 과제로 등록 (TaskFileGenerate)
 *   · 정답형   — 선다형·진위형·단답형 등 → 문항을 유형별로 분류해 문제 은행에 저장 (ItemExtractWizard)
 *                이후 「과제 배치」에서 평가 문항으로 엮어 Ncode 시험지로 출력·채점 (준비 중)
 * 같은 서술형 문항이라도 시험지 안에 들어가면 정답형 과제의 일부가 되므로, 분기는 문항 유형이 아니라 교사가 고른다.
 */
import React, { useState } from 'react';
import TaskFileGenerate from './TaskFileGenerate';
import ItemExtractWizard from './ItemExtractWizard';

const KINDS = {
  essay: {
    icon: '📝', title: '서·논술형', color: '#7C3AED', bg: '#F5F3FF',
    summary: '문항별 답안지에 서술하고, 채점 기준표(루브릭)로 AI가 채점합니다.',
    points: ['자료를 읽어 바로 서·논술 과제로 등록', '문항·모범답안·채점 기준·성취기준 자동 입력', '과제당 문항 최대 3개'],
  },
  answer: {
    icon: '✅', title: '정답형', color: '#2A75F3', bg: '#EFF6FF',
    summary: '선다형·진위형·단답형처럼 정답이 정해진 문항입니다. 문제와 답안 칸이 한 장인 시험지로 봅니다.',
    points: ['문항을 유형별로 분류해 문제 은행에 저장', '정답·배점·성취기준 정리, 정답 없는 문항 표시', '과제 배치 → Ncode 시험지 출력·채점 (준비 중)'],
  },
};

const SmartTaskRegistration = ({ onBack, onAdd, onGoItemBank, initialKind = null }) => {
  const [kind, setKind] = useState(initialKind); // null | 'essay' | 'answer' — 문제 은행에서 들어오면 'answer'로 바로 시작

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#475569', fontFamily: 'inherit' }}>← 목록</button>
        <h1 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, margin: 0 }}>✨ 스마트 과제 등록</h1>
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
                  <button key={k} onClick={() => setKind(k)}
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
                서술형 문항이 섞인 시험지도 한 장으로 볼 거라면 <b>정답형</b>을 고르세요. 서술형 문항은 시험지 안의 한 문항으로 들어갑니다.
              </p>
            </>
          )}
          {kind === 'essay' && <TaskFileGenerate embedded onBack={onBack} onAdd={onAdd} />}
          {kind === 'answer' && <ItemExtractWizard onBack={onBack} onGoItemBank={onGoItemBank} />}
        </div>
      </div>
    </div>
  );
};

export default SmartTaskRegistration;

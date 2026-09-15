/**
 * TaskDetail.jsx
 * 과제 상세보기 — task.source('file_upload' | 'direct_input')에 따라 분기 렌더.
 * BASE_TASKS의 mock 데이터(과제 1·2·3 등)는 source 미정의이므로 generic detail로 표시.
 */
import React from 'react';

const labelStyle = { fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#64748B', marginRight: 8 };
const valueStyle = { fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', fontWeight: 700 };
const sectionStyle = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '18px 20px', marginBottom: 16 };
const sectionTitle = { fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginBottom: 12 };

const HeaderBar = ({ task, onBack, onDelete }) => (
  <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'white', borderBottom: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
    <button onClick={onBack} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>← 목록</button>
    <h1 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: 0, color: '#1E293B' }}>{task.title || '제목 없음'}</h1>
    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: task.status === '배포됨' ? '#D1FAE5' : '#FEF3C7', color: task.status === '배포됨' ? '#047857' : '#92400E' }}>{task.status}</span>
    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: task.source === 'file_upload' ? '#EFF6FF' : task.source === 'direct_input' ? '#F5F3FF' : '#F1F5F9', color: task.source === 'file_upload' ? '#1D4ED8' : task.source === 'direct_input' ? '#7C3AED' : '#475569' }}>
      {task.source === 'file_upload' ? '📷 파일 업로드 등록' : task.source === 'direct_input' ? '📝 직접 입력 등록' : '기존 등록'}
    </span>
    {/* [TSK v3.8] 과제 삭제 — 상세에서도 지울 수 있다. 확인창은 상위가 띄운다 */}
    {onDelete && (
      <button onClick={() => onDelete(task)} title="과제와 배포·채점 이력을 삭제합니다 (학생·그룹 정보는 유지)"
        style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', color: '#DC2626', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit' }}>🗑 과제 삭제</button>
    )}
  </header>
);

const MetaRow = ({ task }) => (
  <div style={sectionStyle}>
    <div style={sectionTitle}>📋 기본 정보</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      <div><span style={labelStyle}>학교급·학년</span><span style={valueStyle}>{task.schoolLevel || '-'}</span></div>
      <div><span style={labelStyle}>교과·과목</span><span style={valueStyle}>{task.subject || '-'}{task.subSubject ? ` · ${task.subSubject}` : ''}</span></div>
      <div><span style={labelStyle}>문항 수</span><span style={valueStyle}>{task.questions ?? '-'}개</span></div>
      <div><span style={labelStyle}>총 배점</span><span style={valueStyle}>{task.points ?? '-'}점</span></div>
      <div><span style={labelStyle}>최종 업데이트</span><span style={valueStyle}>{task.lastUpdate || '-'}</span></div>
      <div><span style={labelStyle}>공유 상태</span><span style={valueStyle}>{task.visibility || '비공유'}</span></div>
      {task.competencies && (
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={labelStyle}>핵심 역량</span>
          <span style={valueStyle}>{task.competencies}</span>
        </div>
      )}
    </div>
  </div>
);

// 「파일 업로드」 상세 — 업로드 파일 + 영역 시각화 + 문항별 OCR 텍스트·모범답안·성취기준·채점
const FileUploadTaskDetail = ({ task, onBack, onDelete }) => {
  const d = task.detail || {};
  const { uploadedFile, areas = [], questions = [], evalMode, autoScale } = d;
  return (
    <div style={{ background: '#F4F7FB', minHeight: '100%' }}>
      <HeaderBar task={task} onBack={onBack} onDelete={onDelete} />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px' }}>
        <MetaRow task={task} />

        {/* 업로드 파일 + 영역 좌표 시각화 */}
        {uploadedFile?.dataUrl ? (
          <div style={sectionStyle}>
            <div style={sectionTitle}>📷 업로드 문제지 + 영역 ({areas.filter(a => a.type === 'question').length}개 문항)</div>
            <div style={{ position: 'relative', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', maxWidth: 900, margin: '0 auto' }}>
              <img src={uploadedFile.dataUrl} alt="업로드 문제지" style={{ display: 'block', width: '100%', height: 'auto' }} />
              <svg viewBox={`0 0 ${uploadedFile.width || 1000} ${uploadedFile.height || 1000}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                {areas.filter(a => a.type === 'question').map((a, i) => (
                  <g key={a.id || i}>
                    <rect x={a.rect.x} y={a.rect.y} width={a.rect.w} height={a.rect.h}
                      fill="rgba(42,117,243,0.08)" stroke="#2A75F3" strokeWidth={Math.max(2, (uploadedFile.width || 1000) * 0.003)} />
                    <text x={a.rect.x + 10} y={a.rect.y + 30}
                      fontSize={Math.max(14, (uploadedFile.width || 1000) * 0.018)} fontWeight="800" fill="#1D4ED8">{a.name || `문항 ${i + 1}`}</text>
                  </g>
                ))}
              </svg>
            </div>
            <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 8 }}>업로드: {uploadedFile.name} · {Math.round((uploadedFile.size || 0) / 1024)}KB</div>
          </div>
        ) : (
          <div style={{ ...sectionStyle, background: '#FEF3C7', borderColor: '#FDE68A', color: '#92400E', fontSize: 'var(--neo-font-size-sm)' }}>
            ⚠ 업로드 파일이 보존되지 않았거나 만료되었습니다. (prototype: localStorage 미연동)
          </div>
        )}

        {/* 문항별 OCR 텍스트 + 모범답안 + 성취기준 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>📝 문항 ({questions.length}개)</div>
          {questions.map((q, i) => (
            <div key={q.id || i} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)', color: '#1E293B', marginBottom: 6 }}>문항 {i + 1}{q.standard && <span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', color: '#047857', background: '#D1FAE5', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>성취기준 매핑</span>}</div>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{q.content || '(내용 없음)'}</div>
              {q.modelAnswers && (q.modelAnswers.상 || q.modelAnswers.중 || q.modelAnswers.하) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {['상', '중', '하'].map((lv) => q.modelAnswers[lv] && (
                    <div key={lv} style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
                      <strong style={{ color: lv === '상' ? '#10B981' : lv === '중' ? '#2A75F3' : '#F59E0B' }}>[{lv}]</strong> {q.modelAnswers[lv]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 평가 모드 + 채점 정책 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>⚖️ 평가 방식</div>
          <div><span style={labelStyle}>평가 모드</span><span style={valueStyle}>{evalMode === 'auto' ? '자동평가' : '자율평가'}</span></div>
          {evalMode === 'auto' && (
            <div><span style={labelStyle}>채점 단계</span><span style={valueStyle}>{autoScale || 3}단계</span></div>
          )}
        </div>
      </div>
    </div>
  );
};

// 「직접 입력」 상세 — 지문·문항·성취기준·모범답안·채점
const DirectInputTaskDetail = ({ task, onBack, onDelete }) => {
  const d = task.detail || {};
  const { passage, questions = [], evalMode, autoScale } = d;
  return (
    <div style={{ background: '#F4F7FB', minHeight: '100%' }}>
      <HeaderBar task={task} onBack={onBack} onDelete={onDelete} />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px' }}>
        <MetaRow task={task} />

        {passage && (
          <div style={sectionStyle}>
            <div style={sectionTitle}>📖 지문</div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{passage}</div>
          </div>
        )}

        <div style={sectionStyle}>
          <div style={sectionTitle}>📝 문항 ({questions.length}개)</div>
          {questions.map((q, i) => (
            <div key={q.id || i} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 'var(--neo-font-size-base)', color: '#1E293B', marginBottom: 6 }}>문항 {i + 1}{q.standard && <span style={{ marginLeft: 8, fontSize: 'var(--neo-font-size-xs)', color: '#047857', background: '#D1FAE5', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>성취기준 매핑</span>}</div>
              <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#475569', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{q.content || '(내용 없음)'}</div>
              {q.modelAnswers && (q.modelAnswers.상 || q.modelAnswers.중 || q.modelAnswers.하) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {['상', '중', '하'].map((lv) => q.modelAnswers[lv] && (
                    <div key={lv} style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
                      <strong style={{ color: lv === '상' ? '#10B981' : lv === '중' ? '#2A75F3' : '#F59E0B' }}>[{lv}]</strong> {q.modelAnswers[lv]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>⚖️ 평가 방식</div>
          <div><span style={labelStyle}>평가 모드</span><span style={valueStyle}>{evalMode === 'auto' ? '자동평가' : '자율평가'}</span></div>
          {evalMode === 'auto' && (
            <div><span style={labelStyle}>채점 단계</span><span style={valueStyle}>{autoScale || 3}단계</span></div>
          )}
        </div>
      </div>
    </div>
  );
};

// 기존 BASE_TASKS(mock) — source 미정의 → generic detail
const GenericTaskDetail = ({ task, onBack, onDelete }) => (
  <div style={{ background: '#F4F7FB', minHeight: '100%' }}>
    <HeaderBar task={task} onBack={onBack} onDelete={onDelete} />
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px' }}>
      <MetaRow task={task} />
      <div style={{ ...sectionStyle, background: '#F8FAFC', color: '#64748B', fontSize: 'var(--neo-font-size-sm)' }}>
        ℹ 이 과제는 본 세션 외부에서 등록되었거나 mock 데이터입니다. 상세 정보는 새로 등록한 과제에서 확인할 수 있습니다.
      </div>
    </div>
  </div>
);

// 분기 라우터
const TaskDetail = ({ task, onBack, onDelete }) => {
  if (!task) return null;
  if (task.source === 'file_upload') return <FileUploadTaskDetail task={task} onBack={onBack} onDelete={onDelete} />;
  if (task.source === 'direct_input') return <DirectInputTaskDetail task={task} onBack={onBack} onDelete={onDelete} />;
  return <GenericTaskDetail task={task} onBack={onBack} onDelete={onDelete} />;
};

export default TaskDetail;

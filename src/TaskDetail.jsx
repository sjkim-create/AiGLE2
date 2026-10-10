/**
 * TaskDetail.jsx
 * 과제 상세보기 — task.source('file_upload' | 'direct_input' | 'file_generate')에 따라 분기 렌더.
 * BASE_TASKS의 mock 데이터(과제 1·2·3 등)는 source 미정의이므로 generic detail로 표시.
 */
import React from 'react';
import { IssueList } from './TaskFileGenerate';
import { downloadAssignmentJson } from './lib/assignmentJson';
import ItemCard from './ItemCard';
import { ITEM_TYPES } from './lib/itemBank';

const labelStyle = { fontSize: 'var(--neo-font-size-sm)', fontWeight: 700, color: '#64748B', marginRight: 8 };
const valueStyle = { fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', fontWeight: 700 };
const sectionStyle = { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '18px 20px', marginBottom: 16 };
const sectionTitle = { fontSize: 'var(--neo-font-size-base)', fontWeight: 800, color: '#1E293B', marginBottom: 12 };

const SOURCE_BADGE = {
  file_upload: { label: '📷 파일 업로드 등록', bg: '#EFF6FF', color: '#1D4ED8' },
  direct_input: { label: '📝 직접 입력 등록', bg: '#F5F3FF', color: '#7C3AED' },
  file_generate: { label: '📄 파일로 생성', bg: '#FFFBEB', color: '#B45309' },
  answer_based: { label: '✅ 정답형 과제', bg: '#EFF6FF', color: '#1D4ED8' },
};

// onEdit — 서·논술 과제를 직접 입력 2 화면으로 열어 고친다 (TSK-13 · TSK-14)
const HeaderBar = ({ task, onBack, onDelete, onEdit }) => (
  <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'white', borderBottom: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
    <button onClick={onBack} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)' }}>← 목록</button>
    <h1 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 900, margin: 0, color: '#1E293B' }}>{task.title || '제목 없음'}</h1>
    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: task.status === '배포됨' ? '#D1FAE5' : '#FEF3C7', color: task.status === '배포됨' ? '#047857' : '#92400E' }}>{task.status}</span>
    <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: SOURCE_BADGE[task.source]?.bg || '#F1F5F9', color: SOURCE_BADGE[task.source]?.color || '#475569' }}>
      {task.source === 'direct_input' && task.detail?.fromFile ? '✨ 스마트 등록 · ✏️ 수정됨' : (SOURCE_BADGE[task.source]?.label || '기존 등록')}
    </span>
    {onEdit && (
      <button onClick={() => onEdit(task)} title="지문·문항·성취기준·채점 기준·모범답안(그림 포함)을 서·논술형 직접 등록 화면에서 고칩니다"
        style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, border: '1px solid #2A75F3', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit' }}>✏️ 직접 등록 화면에서 수정</button>
    )}
    {/* [TSK v3.8] 과제 삭제 — 상세에서도 지울 수 있다. 확인창은 상위가 띄운다 */}
    {onDelete && (
      <button onClick={() => onDelete(task)} title="과제와 배포·채점 이력을 삭제합니다 (학생·그룹 정보는 유지)"
        style={{ marginLeft: onEdit ? 0 : 'auto', padding: '8px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', color: '#DC2626', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit' }}>🗑 과제 삭제</button>
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
  const { uploadedFile, areas = [], questions = [] } = d;
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

        {/* [v3.74] 평가 기준 — 자동평가 폐기, 자율평가 루브릭 단일 체제 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>⚖️ 평가 기준</div>
          <div><span style={labelStyle}>채점 기준</span><span style={valueStyle}>문항 {questions.length}개 · 채점 기준 {questions.reduce((s, q) => s + ((q.criteria || []).length), 0)}개 (루브릭)</span></div>
        </div>
      </div>
    </div>
  );
};

// 「직접 입력」 상세 — 지문·문항·성취기준·모범답안·채점
const DirectInputTaskDetail = ({ task, onBack, onDelete, onEdit }) => {
  const d = task.detail || {};
  const { passage, questions = [] } = d;
  return (
    <div style={{ background: '#F4F7FB', minHeight: '100%' }}>
      <HeaderBar task={task} onBack={onBack} onDelete={onDelete} onEdit={onEdit} />
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
              {(q.contentImages || []).length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {q.contentImages.map((im, k) => <img key={k} src={im.dataUrl} alt={im.label || `그림 ${k + 1}`} style={{ maxWidth: 220, maxHeight: 150, borderRadius: 6, border: '1px solid #E2E8F0', objectFit: 'contain' }} />)}
                </div>
              )}
              {q.modelAnswer?.html && (
                <div style={{ marginTop: 8, fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
                  <strong style={{ color: '#10B981' }}>모범답안</strong>
                  <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: q.modelAnswer.html }} />
                </div>
              )}
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

        {/* [v3.74] 평가 기준 — 자동평가 폐기, 자율평가 루브릭 단일 체제 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>⚖️ 평가 기준</div>
          <div><span style={labelStyle}>채점 기준</span><span style={valueStyle}>문항 {questions.length}개 · 채점 기준 {questions.reduce((s, q) => s + ((q.criteria || []).length), 0)}개 (루브릭)</span></div>
        </div>
      </div>
    </div>
  );
};

// 「파일로 과제 생성」 상세 — 부족한 항목 + 성취기준 + 지문·문항·모범답안(그림) + 자율 평가 기준표
const imgStyle = { maxWidth: 280, maxHeight: 200, borderRadius: 6, border: '1px solid #E2E8F0', objectFit: 'contain', background: 'white' };
const FileGenerateTaskDetail = ({ task, onBack, onDelete, onEdit }) => {
  const d = task.detail || {};
  const { meta = {}, passage, questions = [], issues = [], sourceFile } = d;
  return (
    <div style={{ background: '#F4F7FB', minHeight: '100%' }}>
      <HeaderBar task={task} onBack={onBack} onDelete={onDelete} onEdit={onEdit} />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px' }}>
        <MetaRow task={task} />

        <div style={sectionStyle}>
          <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            🔎 부족한 항목 <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', fontWeight: 700 }}>{sourceFile ? `원본: ${sourceFile.name} · ${sourceFile.pages}쪽` : ''}</span>
            <button onClick={() => downloadAssignmentJson({ ...d, title: task.title })} title="상용 아이글 과제 생성의 「JSON 가져오기」에 올리는 파일"
              style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--neo-font-size-sm)', fontFamily: 'inherit' }}>⬇️ JSON 내려받기</button>
          </div>
          <IssueList issues={issues} />
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>🎯 핵심평가영역 · 성취기준</div>
          {(meta.standards || []).length ? meta.standards.map((st) => (
            <div key={st.id} style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', marginBottom: 6, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 800, color: '#047857', marginRight: 6 }}>{st.areaName}</span>
              <b>{st.code}</b> {st.text}
            </div>
          )) : <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>선택된 성취기준이 없습니다.</div>}
        </div>

        {passage && (
          <div style={sectionStyle}>
            <div style={sectionTitle}>📖 지문</div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{passage}</div>
          </div>
        )}

        {questions.map((q, i) => (
          <div key={q.id || i} style={sectionStyle}>
            <div style={sectionTitle}>📝 문항 {i + 1} <span style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>{q.points}점</span></div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#1E293B', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{q.content || '(내용 없음)'}</div>
            {(q.contentImages || []).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{q.contentImages.map((im, k) => <img key={k} src={im.dataUrl} alt={im.label} title={im.label} style={imgStyle} />)}</div>
            )}

            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', margin: '16px 0 6px' }}>모범답안</div>
            <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.7, background: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
              {q.modelAnswer || '(없음)'}
              {(q.modelAnswerImages || []).length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{q.modelAnswerImages.map((im, k) => <img key={k} src={im.dataUrl} alt={im.label} title={im.label} style={imgStyle} />)}</div>
              )}
            </div>

            <div style={{ fontSize: 'var(--neo-font-size-sm)', fontWeight: 800, color: '#475569', margin: '16px 0 6px' }}>⚖️ 자율 평가 기준표</div>
            {(q.criteria || []).length ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--neo-font-size-sm)', minWidth: 560 }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', color: '#475569' }}>
                      <th style={{ padding: 8, textAlign: 'left', width: '22%' }}>채점 기준</th>
                      {q.criteria[0].levels.map((l, k) => <th key={k} style={{ padding: 8, textAlign: 'left' }}>{l.label || `${k + 1}단계`} · {l.score}점</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {q.criteria.map((c) => (
                      <tr key={c.id} style={{ borderTop: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <td style={{ padding: 8, fontWeight: 800, color: '#1E293B' }}>{c.name}<div style={{ fontWeight: 600, color: '#94A3B8', fontSize: 'var(--neo-font-size-xs)' }}>{c.maxPoints}점</div></td>
                        {c.levels.map((l, k) => <td key={k} style={{ padding: 8, color: '#334155', lineHeight: 1.6 }}>{l.content}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {q.criteria.some((c) => c.feedback) && (
                  <div style={{ marginTop: 8, fontSize: 'var(--neo-font-size-xs)', color: '#64748B', lineHeight: 1.6 }}>
                    {q.criteria.filter((c) => c.feedback).map((c) => <div key={c.id}>💬 {c.name}: {c.feedback}</div>)}
                  </div>
                )}
              </div>
            ) : <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#94A3B8' }}>채점 기준이 없습니다.</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

// [TSK-15] 정답형 과제 상세 — 배치된 문항(스냅샷) · 배점 · 유형 구성
const AnswerTaskDetail = ({ task, onBack, onDelete }) => {
  const d = task.detail || {};
  const entries = d.entries || [];
  const pById = Object.fromEntries((d.passages || []).map((p) => [p.id, p]));
  const typeCount = entries.reduce((acc, e) => ({ ...acc, [e.item.itemType]: (acc[e.item.itemType] || 0) + 1 }), {});
  return (
    <div style={{ background: '#F4F7FB', minHeight: '100%' }}>
      <HeaderBar task={task} onBack={onBack} onDelete={onDelete} />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px' }}>
        <MetaRow task={task} />
        <div style={sectionStyle}>
          <div style={sectionTitle}>🧾 문항 구성</div>
          <div style={{ fontSize: 'var(--neo-font-size-sm)', color: '#334155' }}>
            {Object.entries(typeCount).map(([k, n]) => `${ITEM_TYPES[k]?.icon || ''} ${ITEM_TYPES[k]?.label || k} ${n}`).join(' · ')} — 총 {task.points}점
          </div>
          <div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#94A3B8', marginTop: 6 }}>다음 단계 (준비 중): Ncode 시험지 출력 · 학생 배포 · 정답 대조 채점</div>
        </div>
        {entries.map((e) => (
          <div key={e.item.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 54, paddingTop: 12, textAlign: 'center', fontWeight: 900, color: '#2A75F3' }}>{e.number}번<div style={{ fontSize: 'var(--neo-font-size-xs)', color: '#64748B', fontWeight: 700 }}>{e.points}점</div></div>
            <div style={{ flex: 1, minWidth: 0 }}><ItemCard item={{ ...e.item, number: String(e.number) }} passage={pById[e.item.passageId]} /></div>
          </div>
        ))}
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
const TaskDetail = ({ task, onBack, onDelete, onEdit }) => {
  if (!task) return null;
  if (task.source === 'file_upload') return <FileUploadTaskDetail task={task} onBack={onBack} onDelete={onDelete} />;
  if (task.source === 'direct_input') return <DirectInputTaskDetail task={task} onBack={onBack} onDelete={onDelete} onEdit={onEdit} />;
  if (task.source === 'file_generate') return <FileGenerateTaskDetail task={task} onBack={onBack} onDelete={onDelete} onEdit={onEdit} />;
  if (task.source === 'answer_based') return <AnswerTaskDetail task={task} onBack={onBack} onDelete={onDelete} />;
  return <GenericTaskDetail task={task} onBack={onBack} onDelete={onDelete} />;
};

export default TaskDetail;

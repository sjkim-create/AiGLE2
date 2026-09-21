/**
 * SmartpenSync.jsx
 * 스마트펜 데이터 동기화 대시보드 화면입니다.
 * 학급별 동기화 현황(진행률, 마지막 동기화 시각)을 카드로 표시하고,
 * SmartpenSyncPopup을 열어 일괄 데이터 동기화를 시작하는 진입 화면입니다.
 */
import React, { useState } from 'react';
import SmartpenSyncPopup from './SmartpenSyncPopup';

const SmartpenSync = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('1학년 1반');

  const groups = [
    { id: 1, name: '1학년 1반', studentCount: 25, lastSync: '2024.03.20 14:30', syncLevel: 85 },
    { id: 2, name: '1학년 2반', studentCount: 24, lastSync: '2024.03.20 10:15', syncLevel: 100 },
    { id: 3, name: '1학년 3반', studentCount: 26, lastSync: '2024.03.19 16:45', syncLevel: 60 },
  ];

  return (
    <div className="smartpen-sync-container" style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
      <header className="content-header" style={{ borderBottom: 'none', padding: '0 0 2rem 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="page-title" style={{ fontSize: 'var(--neo-font-size-xxl)', fontWeight: 900 }}>Smartpen Data Synchronizer</div>
          <p style={{ color: '#8A94A1', fontSize: 'var(--neo-font-size-base)' }}>크래들을 사용하여 학급별 스마트펜 데이터를 일괄적으로 동기화하고 관리합니다.</p>
        </div>
        <button 
          className="btn-primary" 
          style={{ padding: '0.8rem 2rem', fontSize: 'var(--neo-font-size-base)', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setIsPopupOpen(true)}
        >
          <span>📥</span> 데이터 일괄 동기화 시작
        </button>
      </header>

      <div className="sync-dashboard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Quick Stats */}
        <section className="sync-card" style={{ background: 'linear-gradient(135deg, #2A75F3 0%, #1A59C8 100%)', color: 'white', padding: '2rem', borderRadius: '24px', boxShadow: '0 20px 40px -10px rgba(42, 117, 243, 0.3)' }}>
          <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 700, marginBottom: '1.5rem', opacity: 0.9 }}>실시간 연결 현황</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>128 <span style={{ fontSize: 'var(--neo-font-size-base)', fontWeight: 500, opacity: 0.8 }}>/ 150</span></div>
              <div style={{ fontSize: 'var(--neo-font-size-base)', opacity: 0.8 }}>동기화 완료된 학생 수</div>
            </div>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '6px solid rgba(255,255,255,0.2)', borderTopColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 'var(--neo-font-size-xl)' }}>
              85%
            </div>
          </div>
        </section>

        <section className="sync-card" style={{ background: 'white', padding: '2rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', border: '1px solid #E8EBED' }}>
          <h3 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '1.5rem' }}>시스템 상태</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ width: '12px', height: '12px', background: '#10B981', borderRadius: '50%', boxShadow: '0 0 10px #10B981' }}></div>
            <div style={{ fontWeight: 700 }}>AiGLE Connect 연결됨</div>
            <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1', marginLeft: 'auto' }}>v2.1.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '12px', height: '12px', background: '#10B981', borderRadius: '50%' }}></div>
            <div style={{ fontWeight: 700 }}>실시간 서버 동기화 활성화</div>
          </div>
        </section>
      </div>

      <div style={{ marginTop: '2.5rem' }}>
        <h3 style={{ fontSize: 'var(--neo-font-size-xl)', fontWeight: 900, marginBottom: '1.5rem' }}>학급별 데이터 현황</h3>
        <div className="groups-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {groups.map(group => (
            <div key={group.id} className="group-card" style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid #E8EBED', transition: 'transform 0.2s', cursor: 'pointer' }} 
                 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} 
                 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: 'var(--neo-font-size-xs)', fontWeight: 700, background: '#F3F4F6', padding: '4px 8px', borderRadius: '6px', color: '#4E5968' }}>{group.studentCount}명 정원</span>
                <span style={{ fontSize: 'var(--neo-font-size-sm)', color: '#8A94A1' }}>{group.lastSync}</span>
              </div>
              <h4 style={{ fontSize: 'var(--neo-font-size-lg)', fontWeight: 800, marginBottom: '0.75rem' }}>{group.name}</h4>
              <div style={{ height: '8px', background: '#F3F4F6', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ width: `${group.syncLevel}%`, height: '100%', background: group.syncLevel === 100 ? '#10B981' : '#2A75F3' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--neo-font-size-sm)', fontWeight: 700 }}>
                <span style={{ color: group.syncLevel === 100 ? '#10B981' : '#2A75F3' }}>동기화 {group.syncLevel}%</span>
                <button 
                  className="btn-card-detail" 
                  style={{ width: 'auto', border: 'none', background: 'none', padding: 0, color: '#2A75F3', textDecoration: 'underline' }}
                  onClick={(e) => { e.stopPropagation(); setIsPopupOpen(true); }}
                >
                  지금 동기화
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SmartpenSyncPopup 
        isOpen={isPopupOpen} 
        onClose={() => setIsPopupOpen(false)} 
        onComplete={() => console.log('Sync completed!')}
      />
    </div>
  );
};

export default SmartpenSync;

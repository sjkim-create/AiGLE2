import React, { useState } from 'react';
import './index.css';
import TeacherDetailDrawer from './TeacherDetailDrawer';

const TeacherManagement = ({ onAdd }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortIndicator = (key) => {
    if (sortKey !== key) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  // 모의 데이터
  const baseTeachers = [
    { no: 1, type: '유료회원', school: '디지털초등학교', name: '박지용', id: 'tch2600059hyH', email: 'garamy3@ai.cne.go.kr', joinDate: '26.04.10', status: '정상', pendingApproval: true, pendingSchoolChange: false },
    { no: 2, type: '무료회원', school: '미래중학교', name: '김나영', id: 'tch2600060nyK', email: 'nayoung@ai.cne.go.kr', joinDate: '26.04.10', status: '학교유료회원 승인신청', pendingApproval: true, pendingSchoolChange: false },
    { no: 3, type: '무료회원', school: '하늘고등학교', name: '이승환', id: 'tch2600061shL', email: 'hwan@ai.cne.go.kr', joinDate: '26.04.09', status: '정상', pendingApproval: false, pendingSchoolChange: true, requestedSchool: '구름고등학교' },
    { no: 4, type: '유료회원', school: '디지털초등학교', name: '최유진', id: 'tch2600062yjC', email: 'yujin@ai.cne.go.kr', joinDate: '26.04.09', status: '정상', pendingApproval: false, pendingSchoolChange: false },
    { no: 5, type: '무료회원', school: '디지털초등학교', name: '한결', id: 'tch2600063ghH', email: '결@ai.cne.go.kr', joinDate: '26.04.08', status: '정상', pendingApproval: false, pendingSchoolChange: false },
  ];

  const teachers = sortKey
    ? [...baseTeachers].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString();
        const bv = (b[sortKey] ?? '').toString();
        const cmp = av.localeCompare(bv, 'ko');
        return sortOrder === 'asc' ? cmp : -cmp;
      })
    : baseTeachers;

  const handleRowClick = (teacher) => {
    setSelectedTeacher(teacher);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedTeacher(null);
  };

  return (
    <div className="content-container" style={{ position: 'relative', overflow: 'hidden' }}>
      <header className="content-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="content-title">교사 관리</h1>
          <p className="content-subtitle">전체 교사 회원의 현황을 파악하고 관리합니다.</p>
        </div>
        <button className="btn-primary-filled" onClick={onAdd}>+ 교사등록</button>
      </header>

      <div className="stu-action-bar">
        <div className="stu-search-box" style={{ width: '400px' }}>
          <input 
            type="text" 
            placeholder="학교명, 교사 이름, 아이디 검색" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-outline active">전체</button>
          <button className="btn-outline">학교 유료 회원</button>
          <button className="btn-outline">무료 회원</button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="stu-table">
          <thead>
            <tr>
              <th className="col-chk"><input type="checkbox" /></th>
              <th className="col-no">No.</th>
              <th>회원 유형</th>
              <th className="th-sortable" onClick={() => handleSort('school')}>학교 {sortIndicator('school')}</th>
              <th className="th-sortable" onClick={() => handleSort('name')}>이름 {sortIndicator('name')}</th>
              <th className="th-sortable" onClick={() => handleSort('id')}>아이디 {sortIndicator('id')}</th>
              <th className="th-sortable" onClick={() => handleSort('joinDate')}>가입일 {sortIndicator('joinDate')}</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.no} onClick={() => handleRowClick(teacher)} style={{ cursor: 'pointer' }}>
                <td className="col-chk" onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                <td>{teacher.no}</td>
                <td>
                  <span className={`badge-text ${teacher.type === '유료회원' ? 'primary' : 'muted'}`}>
                    {teacher.type}
                  </span>
                </td>
                <td>{teacher.school}</td>
                <td style={{ fontWeight: 700 }}>{teacher.name}</td>
                <td>{teacher.id}</td>
                <td>{teacher.joinDate}</td>
                <td>
                  <span style={teacher.status.includes('신청') ? { color: '#EF4444', fontWeight: 700 } : {}}>
                    {teacher.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="p-btn">‹</button>
        <button className="p-btn active">1</button>
        <button className="p-btn">2</button>
        <button className="p-btn">›</button>
      </div>

      <TeacherDetailDrawer 
        isOpen={isDrawerOpen} 
        teacher={selectedTeacher} 
        onClose={closeDrawer} 
      />
    </div>
  );
};

export default TeacherManagement;

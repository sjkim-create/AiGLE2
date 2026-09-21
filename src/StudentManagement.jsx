import React, { useState } from 'react';
import './index.css';
import StudentDetailDrawer from './StudentDetailDrawer';

const StudentManagement = ({ onAdd }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const openDrawer = (stu) => {
        setSelectedStudent(stu);
        setIsDrawerOpen(true);
    };
    const closeDrawer = () => {
        setIsDrawerOpen(false);
        setTimeout(() => setSelectedStudent(null), 300);
    };
    
    const students = [
        { no: 1, name: '이학생', gradeInfo: '1학년 1반 2번', id: 'stu26000028Kv', groupName: '네오초_테스트그룹1', joinDate: '26.03.03' },
        { no: 2, name: '조학생', gradeInfo: '1학년 1반 3번', id: 'stu2600003XOr', groupName: '네오초_테스트그룹1', joinDate: '26.03.03' },
        { no: 3, name: '김학생', gradeInfo: '1학년 1반 1번', id: 'stu2600001mZ8', groupName: '테스트 그룹테스트2', joinDate: '26.03.03' },
    ];

    return (
        <div className="content-container">
            <header className="content-header" style={{ marginBottom: '0.25rem' }}>
                <h1 className="content-title">학생 관리</h1>
                <p className="content-subtitle">전체 학생 회원을 확인 할 수 있습니다.</p>
            </header>

            <div className="stu-action-bar">
                <div className="stu-search-box">
                    <input 
                        type="text" 
                        placeholder="그룹명, 학생 이름으로 검색" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <span className="search-icon">🔍</span>
                </div>
                <button className="btn-primary-filled" onClick={onAdd} style={{ width: '160px' }}>
                    + 학생 등록
                </button>
            </div>

            <div className="table-responsive">
                <table className="stu-table">
                    <thead>
                        <tr>
                            <th className="col-chk"><input type="checkbox" /></th>
                            <th className="col-no">No.</th>
                            <th className="col-name">이름 <span>↓</span></th>
                            <th className="col-grade">학년 / 반 / 번호</th>
                            <th className="col-id">아이디 <span>↓</span></th>
                            <th className="col-group">그룹명</th>
                            <th className="col-date">가입일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((stu) => (
                            <tr key={stu.no} className="row-clickable" onClick={() => openDrawer(stu)}>
                                <td className="col-chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                                <td className="col-no">{stu.no}</td>
                                <td className="col-name">{stu.name}</td>
                                <td className="col-grade">{stu.gradeInfo}</td>
                                <td className="col-id">{stu.id}</td>
                                <td className="col-group">
                                    <span className="ellipsis">{stu.groupName}</span>
                                </td>
                                <td className="col-date">{stu.joinDate}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="pagination">
                <button className="p-btn">|‹</button>
                <button className="p-btn">‹</button>
                <button className="p-btn active">1</button>
                <button className="p-btn">›</button>
                <button className="p-btn">›|</button>
            </div>

            <StudentDetailDrawer
                isOpen={isDrawerOpen}
                student={selectedStudent}
                onClose={closeDrawer}
            />
        </div>
    );
};

export default StudentManagement;

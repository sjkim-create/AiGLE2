/**
 * main.jsx
 * 앱의 최상위 진입점(Entry Point) 파일입니다.
 * React 루트를 생성하고 최상위 컴포넌트인 Setting을 마운트합니다.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import Setting from './Setting.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Setting />
  </React.StrictMode>,
)

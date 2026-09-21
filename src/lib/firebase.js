/**
 * firebase.js — Firebase 앱 초기화 (프로젝트 aigle2-ff923)
 *
 * 아래 config 값은 Firebase 웹 앱 식별자로, 공개되어도 되는 값이다 (Firebase 공식 가이드).
 * 데이터 보호는 Firestore 보안 규칙(firestore.rules)이 담당한다.
 *   · 확인: firebase apps:sdkconfig WEB 1:849345289543:web:46acbba0de64a212354062
 *   · apiKey 만 VITE_FIREBASE_API_KEY(.env)로 뺐다 — 보안 때문이 아니라 GitHub secret scanning 이
 *     `AIza…` 패턴을 종류 구분 없이 잡아 알림을 내기 때문 (2026-09-21). 배포 번들에는 여전히 그대로 실린다.
 */
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: 'aigle2-ff923.firebaseapp.com',
  projectId: 'aigle2-ff923',
  storageBucket: 'aigle2-ff923.firebasestorage.app',
  messagingSenderId: '849345289543',
  appId: '1:849345289543:web:46acbba0de64a212354062',
};

if (!firebaseConfig.apiKey) console.warn('[firebase] VITE_FIREBASE_API_KEY 가 비어 있습니다. .env 를 확인하세요 (.env.example 참고).');
export const app = initializeApp(firebaseConfig);
// undefined 필드는 Firestore가 거부하므로 무시하도록 설정 (예: studentCount 없음)
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

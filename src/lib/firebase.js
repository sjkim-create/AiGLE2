/**
 * firebase.js — Firebase 앱 초기화 (프로젝트 aigle2-ff923)
 *
 * 아래 config 값은 Firebase 웹 앱 식별자로, 공개되어도 되는 값이다 (Firebase 공식 가이드).
 * 데이터 보호는 Firestore 보안 규칙(firestore.rules)이 담당한다 — 비밀 키가 아니므로 .env에 두지 않는다.
 *   · 확인: firebase apps:sdkconfig WEB 1:849345289543:web:46acbba0de64a212354062
 */
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBvzx-qMdrc58QGV3jFKmE-kCftGKl4Ch4',
  authDomain: 'aigle2-ff923.firebaseapp.com',
  projectId: 'aigle2-ff923',
  storageBucket: 'aigle2-ff923.firebasestorage.app',
  messagingSenderId: '849345289543',
  appId: '1:849345289543:web:46acbba0de64a212354062',
};

export const app = initializeApp(firebaseConfig);
// undefined 필드는 Firestore가 거부하므로 무시하도록 설정 (예: studentCount 없음)
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

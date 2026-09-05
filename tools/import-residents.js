#!/usr/bin/env node
/**
 * 조합원 계정 일괄 등록 / 비밀번호 재설정
 *
 *   npm i firebase-admin
 *   export GOOGLE_APPLICATION_CREDENTIALS=/경로/serviceAccount.json
 *   node tools/import-residents.js residents.csv
 *
 * CSV 형식 (헤더 한 줄은 있어도 되고 없어도 된다):
 *   dong,ho,password
 *   103,305,3166
 *
 * 이미 있는 세대는 비밀번호를 새로 지정한다. 여러 번 돌려도 안전하며,
 * 비밀번호를 잊은 조합원의 재설정에도 같은 스크립트를 쓴다.
 */
const fs = require('fs');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const RESIDENT_DOMAIN = 'resident.maehwa1.kr';
const PW_PREFIX = 'mh1!'; // assets/core.js 의 값과 반드시 같아야 한다

const file = process.argv[2];
if (!file) {
  console.error('사용법: node tools/import-residents.js <csv파일>');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length && !/^\d/.test(lines[0])) lines.shift(); // 헤더 제거
  return lines.map((line, i) => {
    const [dong, ho, password] = line.split(/[,\t]/).map(v => (v || '').trim());
    if (!/^\d{1,5}$/.test(dong || '') || !/^\d{1,5}$/.test(ho || '') || !password || password.length < 4) {
      throw new Error(`${i + 1}번째 줄 형식 오류: ${line}`);
    }
    return { dong, ho, password };
  });
}

async function upsert({ dong, ho, password }) {
  const email = `${dong}-${ho}@${RESIDENT_DOMAIN}`;
  const pw = PW_PREFIX + password;
  let user;
  let created = false;
  try {
    user = await auth.createUser({ email, password: pw });
    created = true;
  } catch (e) {
    if (e.code !== 'auth/email-already-exists') throw e;
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: pw });
  }
  // pwChanged 를 false 로 되돌려 첫 입장 시 변경을 다시 강제한다.
  await db.collection('users').doc(user.uid).set({
    dong, ho, pwChanged: false, createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return created;
}

(async () => {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  console.log(`${rows.length}세대 처리 시작...`);
  let created = 0, updated = 0;
  const failures = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (await upsert(row)) created++; else updated++;
    } catch (e) {
      failures.push(`${row.dong}동 ${row.ho}호 — ${e.code || e.message}`);
    }
    if ((i + 1) % 50 === 0 || i === rows.length - 1) {
      process.stdout.write(`\r  진행 ${i + 1}/${rows.length}  신규 ${created} · 재설정 ${updated} · 실패 ${failures.length}`);
    }
  }
  console.log(`\n완료 — 신규 ${created}세대, 재설정 ${updated}세대, 실패 ${failures.length}세대`);
  if (failures.length) console.error(failures.join('\n'));
  process.exit(failures.length ? 1 : 0);
})();

# 매화마을1단지 리모델링 Q&A

주민설명회 사전질의 수집용 정적 웹페이지. 서버 없이 GitHub Pages + Firebase(Auth/Firestore)로 동작합니다.

## 구조

```
index.html            화면 마크업
assets/styles.css     스타일
assets/core.js        Firebase 초기화 · 공용 상수/헬퍼
assets/auth.js        로그인 게이트 (동호수 + 휴대폰 뒷자리, 관리자 이메일)
assets/faq.js         자주 묻는 질문 탭
assets/board.js       질문 게시판 탭
assets/app.js         탭 전환 · 모달 · 부트스트랩
firestore.rules       Firestore 보안 규칙
```

## 로그인 방식

조합원은 **동 + 호수 + 휴대폰 뒷 4자리**로 입장합니다. 내부적으로는
`{동}-{호수}@resident.maehwa1.kr` 형태의 Firebase 계정을 만들고, 휴대폰 뒷자리를
비밀번호 재료로 씁니다. 실제로 메일이 오가지 않는 내부 전용 주소입니다.

첫 입장 시 계정이 자동 생성되고, 이후 같은 정보로 다시 입장합니다.
같은 동호수에 다른 뒷자리를 넣으면 "이미 등록되어 있습니다" 안내가 나옵니다.

관리자는 게이트 하단 **관리자 로그인** 링크에서 이메일/비밀번호로 들어갑니다.

> **보안 수준에 대한 참고** — 동·호수는 공개 정보이므로 실질적인 비밀은 휴대폰 뒷 4자리
> (1만 가지)뿐입니다. Firebase의 로그인 시도 제한이 무차별 대입을 막아주지만,
> 금융·개인정보 수준의 보호가 필요한 용도로는 적합하지 않습니다.
> 사전질의 수집이라는 목적에는 충분하되, 민감정보는 게시판에 적지 않도록 안내하세요.

## Firebase 최초 설정

1. **Authentication → Sign-in method** — 이메일/비밀번호 사용 설정
2. **Authentication → Users** — 관리자 계정을 직접 추가
3. **Firestore → 데이터** — `config/admins` 문서 생성, `emails` 필드(배열)에 관리자 이메일 등록
4. **Firestore → 규칙** — `firestore.rules` 내용을 붙여넣고 게시

색인은 따로 만들 필요가 없습니다. 조합원 조회는 `authorUid` 단일 조건이고,
관리자 조회는 `createdAt` 단일 정렬이라 자동 색인으로 처리됩니다.

## 데이터 모델

| 컬렉션 | 용도 | 읽기 권한 |
|---|---|---|
| `qa_items` | 자주 묻는 질문 | 로그인한 모든 조합원 |
| `questions` | 질문 게시판 | **작성자 본인 + 관리자만** |
| `users` | 동·호수 명부 | 본인 + 관리자 |
| `config/admins` | 관리자 이메일 목록 | 로그인한 모든 조합원 |

게시판의 비공개는 화면에서 가리는 방식이 아니라 `firestore.rules`가 강제합니다.
다른 사람의 질문은 브라우저 개발자 도구로도 읽을 수 없습니다.

## 로컬 확인

ES 모듈이라 `file://`로 열면 동작하지 않습니다. 정적 서버가 필요합니다.

```bash
npx serve -l 4173 .
```

## 배포

`main` 브랜치에 푸시하면 GitHub Pages가 자동 반영합니다.

## 커스텀 도메인 (maehwa1-remodeling.com)

저장소 루트의 `CNAME` 파일이 도메인을 지정합니다. 나머지는 Spaceship DNS와
Firebase 콘솔에서 한 번만 설정하면 됩니다.

### 1. Spaceship DNS 레코드

Spaceship → 해당 도메인 → DNS 레코드 화면에서 아래를 추가합니다.
파킹 페이지용 기본 레코드가 있으면 먼저 지웁니다.

| 종류 | 호스트 | 값 |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | jeongin.github.io |

IPv6도 쓰려면 AAAA 레코드로 `2606:50c0:8000::153`, `2606:50c0:8001::153`,
`2606:50c0:8002::153`, `2606:50c0:8003::153` 를 `@` 에 추가합니다. 선택 사항입니다.

### 2. GitHub Pages

`CNAME` 파일이 푸시되면 **Settings → Pages** 의 커스텀 도메인이 자동으로 채워집니다.
DNS 검사가 통과하고 인증서가 발급된 뒤 **Enforce HTTPS** 를 켭니다.
발급까지 보통 몇 분에서 최대 24시간 걸립니다.

### 3. Firebase 승인된 도메인 (필수)

**Authentication → Settings → 승인된 도메인** 에 아래 둘을 추가합니다.

- `maehwa1-remodeling.com`
- `www.maehwa1-remodeling.com`

이 단계를 빠뜨리면 새 주소에서 로그인이 `auth/unauthorized-domain` 으로 실패합니다.

### 확인

```bash
dig +short maehwa1-remodeling.com
curl -sI https://maehwa1-remodeling.com | head -1
```

# ☀️ 모닝 웨더 8AM (Morning Weather Briefing PWA)

매일 아침 **한국 시간(KST) 오전 8시 정각**에 오늘의 최고/최저 기온, 강수 확률, 미세먼지 및 우산 지참 팁을 **Web Push 알림**으로 보내주는 **9:16 모바일 최적화 날씨 웹앱(PWA)**입니다.

---

## ✨ 주요 기능

1. **9:16 모바일 고정 뷰포트 & 글래스모피즘 UI**
   - 데스크톱에서도 스마트폰 화면처럼 보이는 `aspect-[9/16] max-w-[400px] w-full h-screen max-h-[850px]` 컨테이너 적용 (모바일 기기에서는 전체 화면 렌더링).
   - 실시간 WMO 날씨 코드(맑음, 구름, 흐림, 안개, 비, 눈, 뇌우)에 따라 배경 그라데이션과 대형 아이콘이 동적으로 변화합니다.
2. **무료·무인증 Open-Meteo 기상 데이터 연동**
   - API Key 없이 즉시 동작하며 기상청(KMA) 및 글로벌 예보 모델을 지원하는 Open-Meteo Forecast & Air Quality API를 사용합니다.
   - 대한민국 주요 도시(서울, 부산, 인천, 대구, 대전, 광주, 울산, 수원, 세종, 제주) 드롭다운 선택 및 **Geolocation API(내 현재 위치 GPS)**를 지원합니다.
3. **PWA & Web Push 알림 (`web-push` + Service Worker)**
   - 모바일 홈 화면에 추가(Add to Home Screen) 가능한 매니페스트(`public/manifest.json`)와 서비스 워커(`public/sw.js`)가 포함되어 있습니다.
   - 하단 토글 버튼으로 **"매일 아침 8시 날씨 알림 받기 (구독 On/Off)"** 및 **"푸시 알림 즉시 테스트"**를 바로 실행할 수 있습니다.
4. **Vercel Cron 기반 매일 아침 8시(KST) 스케줄링**
   - `vercel.json`의 `"schedule": "0 23 * * *"` (UTC 23:00 = KST 08:00) 설정으로 매일 아침 자동 실행됩니다.
   - 서버리스 환경을 고려하여 **Upstash Redis / Vercel KV**, **`SUBSCRIPTION_DATA` 환경변수 폴백**, **파일/인메모리 폴백**의 3중 스토리지 계층(`src/lib/storage.ts`)을 제공합니다.

---

## 📂 디렉토리 구조

```text
├── public/
│   ├── icon.svg                      # PWA 및 푸시 알림 아이콘
│   ├── manifest.json                 # 모바일 홈 화면 추가용 Web App Manifest
│   └── sw.js                         # 푸시 수신 및 클릭 시 앱 오픈 Service Worker
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── subscribe/route.ts    # 푸시 구독 등록/해지 및 즉시 테스트 발송 API
│   │   │   └── cron/weather/route.ts # 매일 아침 8시(KST) 실행되는 Vercel Cron API
│   │   ├── globals.css               # Tailwind CSS 및 모바일 뷰포트 스타일
│   │   ├── layout.tsx                # PWA 메타데이터 및 루트 레이아웃
│   │   └── page.tsx                  # 9:16 글래스모피즘 메인 날씨 브리핑 UI
│   └── lib/
│       ├── weather.ts                # Open-Meteo API 호출 및 WMO 코드 한국어 변환
│       ├── storage.ts                # 서버리스 구독 데이터 저장소 헬퍼 (Redis/Env/Memory)
│       └── push.ts                   # VAPID 설정 및 web-push 발송 유틸리티
├── .env.example                      # 환경변수 템플릿 및 VAPID 생성 안내
├── vercel.json                       # KST 08:00 (UTC 23:00) Vercel Cron 설정
└── package.json
```

---

## 🚀 1. 로컬 실행 및 VAPID 키 생성 방법

### 1) 패키지 설치
```bash
npm install
```

### 2) VAPID 키 쌍 생성
터미널에서 아래 명령어를 실행하여 Web Push용 공개키(Public Key)와 개인키(Private Key)를 생성합니다.
```bash
npx web-push generate-vapid-keys
# 또는
npm run generate-vapid
```

### 3) `.env.local` 파일 생성
`.env.example`을 복사하여 `.env.local`을 만들고 생성된 키를 입력합니다.
```bash
cp .env.example .env.local
```
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="생성된_Public_Key"
VAPID_PRIVATE_KEY="생성된_Private_Key"
VAPID_SUBJECT="mailto:your-email@example.com"
CRON_SECRET="my-secret-cron-token"
```

### 4) 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`에 접속하여 **"매일 아침 8시 날씨 알림 받기"**를 켜고 **"푸시 알림 즉시 테스트"** 버튼을 눌러 알림이 도착하는지 확인합니다.

---

## ☁️ 2. GitHub 연동 및 Vercel 프로덕션 배포 가이드

### 1) GitHub 저장소에 코드 푸시
```bash
git init
git add .
git commit -m "feat: morning weather 8am PWA with web push and vercel cron"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git push -u origin main
```

### 2) Vercel 프로젝트 Import 및 환경변수 설정
1. [Vercel Dashboard](https://vercel.com/new)에서 방금 푸시한 GitHub 저장소를 **Import**합니다.
2. **Environment Variables** 섹션에 아래 항목들을 등록합니다:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: 생성한 VAPID 공개키
   - `VAPID_PRIVATE_KEY`: 생성한 VAPID 개인키
   - `VAPID_SUBJECT`: `mailto:본인이메일@example.com`
   - `CRON_SECRET`: 임의의 안전한 문자열 (Vercel Cron이 `/api/cron/weather` 호출 시 `Authorization: Bearer <CRON_SECRET>`으로 자동 전송)
3. **구독 정보 영구 유지 설정 (택 1)**:
   - **방법 A (DB 없이 단일 사용자 간편 설정)**: 배포된 웹앱에서 알림 구독을 켠 뒤 하단에 나타나는 **[구독키 복사]** 버튼을 클릭하여 복사한 JSON 문자열을 Vercel 환경변수 `SUBSCRIPTION_DATA`에 붙여넣고 재배포합니다.
   - **방법 B (다중 사용자 DB 연동)**: Vercel Storage(Upstash Redis / Vercel KV)를 연결하면 `UPSTASH_REDIS_REST_URL`과 `UPSTASH_REDIS_REST_TOKEN`이 자동 주입되어 모든 사용자의 구독 정보가 영구 저장됩니다.
4. **Deploy** 버튼을 누르면 배포와 함께 `vercel.json`에 정의된 Cron Job(`0 23 * * *` UTC = 매일 아침 8시 KST)이 자동 활성화됩니다.

---

## 🧪 3. 크론 엔드포인트 수동 테스트

배포 후 또는 로컬에서 아래 URL을 호출하면 아침 8시 크론 발송 로직을 즉시 테스트할 수 있습니다:
```bash
# 로컬 테스트
curl http://localhost:3000/api/cron/weather

# 프로덕션 테스트 (CRON_SECRET 설정 시)
curl -H "Authorization: Bearer <CRON_SECRET>" https://<YOUR_VERCEL_DOMAIN>/api/cron/weather
```

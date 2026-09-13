# portfolio-lens — AI 에이전트 온보딩

개인 포트폴리오 **정적 계산기**. 빌드·백엔드 없음. `index.html` + `app.js` + `style.css` 단일 페이지 앱.

## 한 줄 요약

사용자가 종목·현금·환율을 입력하면 4버킷 배분·익스포저·손익·YTD/YOY를 브라우저에서만 계산해 보여 준다. 데이터는 `localStorage`에만 저장된다.

## 디자인·로직 정본 (참고용)

- **UI/UX 참고**: `../life-log-dashboard/dashboard/src/tabs/assets.js`, `../life-log-dashboard/dashboard/src/styles/components.css` 의 **투자 탭**
- **개인 수치·계좌 구조는 가져오지 말 것** — 패턴·레이아웃·용어만 참고
- life-log의 연금 토글·계좌별 보유·액티브 share·엑셀 버킷은 이 프로젝트 범위 밖

## 파일 맵

| 파일 | 역할 |
|------|------|
| `index.html` | 탭 UI, 입력 폼, `#analyzeRoot` |
| `app.js` | 전부: 상태·계산·렌더·이벤트 |
| `style.css` | Toss 톤 UI, 분석 카드 스타일 |
| `scripts/verify.py` | 샘플 포트폴리오 수치 검산 (선택) |
| `samples/demo-portfolio.json` | 데모 JSON (localStorage 주입용) |

## 데이터 모델 (`localStorage` 키: `portfolio-lens-v3`)

```json
{
  "fx": 1400,
  "cashKrw": 0,
  "cashUsd": 0,
  "holdings": [
    { "name": "", "ticker": "", "shares": 0, "currency": "KRW|USD", "price": 0, "avgPrice": null, "bucket": null }
  ],
  "performance": {
    "yearEndValue": null,
    "ytdNetFlow": 0,
    "yearAgoValue": null,
    "yoyNetFlow": 0
  },
  "targets": { "인덱스": 50, "개별종목": 20, "현금": 25, "크립토": 5 },
  "cashBand": { "min": 20, "max": 30 }
}
```

- `bucket: null` → `autoBucket()` 자동 분류 (행에서 수동 override 가능)
- `performance.*Value`가 비어 있으면 YTD/YOY는 `—` (자동 추정 없음)

## 4버킷 분류 규칙 (종목 기준, 계좌 무관)

1. **크립토** — BTC/ETH/금 ETF·이름 패턴
2. **개별종목** — 레버리지·인버스, 섹터/테마 ETF, 단일주
3. **인덱스** — SPY/QQQ 등 순수 지수 ETF, 지수명 패턴
4. **현금** — `cashKrw` / `cashUsd` 합산 (종목 행 아님)

목표 배분 ±**5%p** 초과 시 히어로 틱에서 과다/부족. **현금**은 목표 대신 **관찰 밴드**(`cashBand`)만 사용.

## 분석 탭 구성 (`renderAnalyze`)

1. **히어로** — 총 평가액, 평가손익, YTD/YOY pill, 4버킷 틱(클릭 → 버킷 모달)
2. **현금 관찰선** — 밴드 안/밖 상태
3. **종목 비중** (fold) — 상위 10, 동일 지수 ETF 합산
4. **익스포저** (fold) — 국장/미장, AI 우산, 반도체 (카드 클릭 → 모달)
5. **벤치마크** — 내 포트폴리오 vs S&P 500

**제거됨 (다시 넣지 말 것)**: `포트폴리오 비중 — 4버킷 (큰그림)` fold, `목표 배분 vs 현재` fold — 히어로 틱과 중복.

## 핵심 함수 (`app.js`)

- `compute(state)` → 분석 결과 객체
- `aggregateHoldings`, `bucketRows`, `pnlSummary`, `portfolioReturn`
- `renderAnalyzeHome`, `renderCashMonitor`, `renderStockWeights`, `renderExposureBlock`, `renderBenchmarkBlock`
- `window.__portfolioLens` — Node 없이 브라우저 콘솔/테스트용 export

## 로컬 실행

```bash
python3 -m http.server 8123
# http://localhost:8123/index.html
```

`file://` 로 열면 `localStorage`가 막힐 수 있음. 반드시 HTTP 서버 사용.

데모 데이터 주입 (브라우저 콘솔):

```javascript
fetch('/samples/demo-portfolio.json').then(r=>r.json()).then(s=>{
  localStorage.setItem('portfolio-lens-v3', JSON.stringify(s));
  localStorage.setItem('portfolio-lens-tab','analyze');
  location.reload();
});
```

## 작업 규칙

- **프레임워크 추가 금지** — 바닐라 JS/CSS 유지
- **시세 API 연동 금지** — 사용자가 현재가 직접 입력
- **투자 조언 문구 금지** — "매수/매도하세요" 대신 "목표까지 조정 금액" 등 중립 표현
- 분석 탭 입력 변경 시 `refreshAnalyzeIfVisible()` 호출 유지
- 스타일은 life-log 투자 탭과 톤 맞추되 `--red`=상승, `--blue`=하락 (한국 주식 UI 관습)
- 변경 후 `scripts/verify.py` 실행 가능하면 실행
- 커밋 메시지는 영어 imperative, 본문은 변경 이유 한 줄

## 자주 하는 실수

| 증상 | 원인 |
|------|------|
| YTD/YOY가 `—` | `performance.yearEndValue` / `yearAgoValue` 미입력 |
| 분석이 안 바뀜 | 입력 후 `refreshAnalyzeIfVisible()` 누락 |
| 버킷이 이상함 | 섹터 ETF는 개별종목 — 인덱스로 두면 안 됨 |
| localStorage 오류 | `file://` 프로토콜로 연 경우 |

## 범위 밖 (요청 시 먼저 확인)

- 다계좌·연금 포함/제외 토글
- 실시간 시세·환율 API
- 서버 동기화·로그인
- life-log-dashboard 데이터 직접 import

# 포폴 렌즈

보유 종목을 넣으면 비중과 국장/미장 비율을 보여 주는 정적 계산기입니다.

시세 API 없이 현재가를 직접 입력합니다. 보유는 브라우저 `localStorage`에만 남습니다.

- 데모: https://dosanhoon.github.io/portfolio-lens/
- 종목 관리에서 KRW/USD 종목, 환율, 원화·달러 현금을 입력
- 같은 티커 자동 합산, 입력 통화 기준 국장/미장 구분
- life-log-dashboard **투자 탭** UI/패턴 참고: 히어로 · 4버킷 틱 · 현금 관찰선 · 종목 비중 · 익스포저 · 벤치마크
- 4버킷(인덱스·개별종목·현금·크립토) 자동 분류. 행마다 분류를 직접 고를 수도 있습니다
- 히어로 4칸에서 목표 대비 과다/부족(±5%p) 확인, 버킷 클릭 시 구성 종목 모달
- 현금 비중은 관찰 범위(기본 20~30%) 안에 있는지만 봅니다. 매매 방아쇠가 아닙니다
- 평단을 넣은 종목은 평가손익과 종목별 수익률, 상위 3종목 집중도까지 표시합니다
- YTD·YOY는 **전년도 말·1년 전 평가액** 입력 시 표시 (종목 관리 상단 기준금액)
- 시트·JSON·엑셀 붙여넣기와 JSON 백업 (엑셀 일곱 번째 칸은 분류)
- 투자 조언이 아닙니다.

## 로컬 실행

```bash
python3 -m http.server 8123
# http://localhost:8123/index.html
```

## AI 에이전트

- **온보딩 문서**: [AGENTS.md](./AGENTS.md) — 파일 구조, 데이터 모델, 분류 규칙, 하지 말아야 할 것
- **디자인 참고**: 같은 머신의 `life-log-dashboard` → `dashboard/src/tabs/assets.js`

### 바로 붙여넣기용 프롬프트

아래 블록을 새 AI 세션 첫 메시지로 복사해 사용하세요.

```
portfolio-lens 작업을 이어서 해줘.

먼저 AGENTS.md를 읽고, app.js / index.html / style.css 구조를 파악해.
이 프로젝트는 바닐라 JS 정적 SPA이고 localStorage만 쓴다. 빌드·API·프레임워크 추가 금지.

디자인·UX 참고는 ../life-log-dashboard 투자 탭(assets.js, components.css)이지만
개인 계좌/수치는 가져오지 마. 패턴과 용어만 맞춰.

4버킷 분류는 종목 기준: 섹터·테마 ETF·레버리지 = 개별종목, 순수 지수 = 인덱스.
분석 탭에는 히어로(4버킷 틱) / 현금 관찰선 / 종목 비중 / 익스포저 / 벤치마크만 둔다.
「포트폴리오 비중 4버킷 큰그림」「목표 배분 vs 현재」 fold 카드는 중복이라 제거된 상태 — 다시 추가하지 마.

YTD·YOY는 performance.yearEndValue, yearAgoValue 입력 없으면 — 로 표시. 자동 추정하지 마.
입력 변경 시 refreshAnalyzeIfVisible()로 분석 탭 즉시 갱신.

로컬 확인: python3 -m http.server 8123 → /samples/demo-portfolio.json 으로 데모 주입 가능.
작업 후 scripts/verify.py 돌리고, 커밋·푸시는 사용자가 요청할 때만.

[여기에 이번에 할 작업을 적어]
```

### 작업 예시 (프롬프트 `[여기에…]` 자리)

- `익스포저 모달에 국장/미장 섹션 소계 추가해줘`
- `엑셀 붙여넣기 8번째 칸에 메모 필드 추가해줘`
- `life-log 투자 탭 벤치마크 카드 스타일 더 맞춰줘`

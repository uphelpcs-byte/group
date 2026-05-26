# 업도움 그룹웨어 리포트 & 고객사 관리 확장

## 1. DB 마이그레이션

**`clients` 테이블에 컬럼 추가:**
- `channeltalk_access_key` (text)
- `channeltalk_secret` (text)
- `manager_email` (text)
- `monthly_fee` (numeric)
- `contract_start_date` (date)
- `report_show_tags` (boolean, default true)
- `report_show_first_response` (boolean, default true)
- `report_show_response_rate` (boolean, default false)
- `report_top_comment` (text)

**새 테이블 `report_send_history`:**
- `client_id`, `report_type` ('weekly_cs' | 'invoice'), `period_start`, `period_end`, `sent_to`, `sent_by`, `subject`, `sent_at`
- RLS: manager_plus only

## 2. Edge Functions

**`channeltalk-fetch`** — 채널톡 API 프록시 (CORS 우회)
- Input: `{ apiKey, apiSecret, from, to }`
- since/until 타임스탬프 계산 → `GET /public/v9/user-chats`
- `data.next` 페이지네이션 (after 파라미터, limit=50, state=closed)
- 모든 chats 합쳐서 반환

**`send-report-email`** — Gmail 발송
- Input: `{ to, subject, html, clientId, reportType, periodStart, periodEnd }`
- Resend connector 사용 (이미 가능) 또는 Lovable Email
- 발송 후 `report_send_history` 기록
- (사용자가 Gmail SMTP 별도 구성 안 했으므로 Resend 발송 + 발신자명 "업도움" 사용. 추후 Gmail 직접 발송 필요시 OAuth 추가 안내)

## 3. 고객사 관리 UI (`ClientDialog`)

기존 폼에 새 섹션 추가:
- **채널톡 연동**: Access Key (마스킹 표시), Secret (password input)
- **계약 정보**: 담당자 이메일, 월 계약금액(VAT별도), 계약 시작일
- **리포트 설정**: 태그 표시 토글, 첫 응답시간 토글, 응대율 토글, 상단 코멘트 textarea

## 4. 리포트 페이지 (`Reports.tsx`)

탭 구조: `주간 CS 리포트` | `인보이스 발송` | (기존 탭이 있다면 유지)

### 주간 CS 리포트 탭
- 고객사 select (clients에서 fetch)
- 시작일/종료일 (DatePicker, 기본값: 지난주 월~일)
- **"데이터 가져오기"** → `channeltalk-fetch` edge function 호출
- 집계:
  - 총 인입: chats.length
  - 총 응대: firstAnsweredAt 있는 건
  - 일별 인입/응대/평균첫응답 (createdAt 기준)
  - 태그별 인입 (chat.tags 집계)
- 미리보기:
  - 상단 코멘트 (설정 시)
  - KPI 카드: 인입 / 응대 / (옵션) 응대율
  - 일별 테이블 (첫응답 컬럼 토글 반영)
  - 태그 테이블 (태그 0건이면 자동 숨김)
- CORS/에러 시 toast 안내
- "PDF 저장" (jsPDF + html2canvas로 HTML 렌더링 캡처)
- "Gmail 발송" → manager_email로 send-report-email 호출

### 인보이스 발송 탭
- 고객사 select
- 청구월 picker (month input)
- 금액 input (계약금액 자동 채움, 수정 가능)
- 미리보기: 공급가액 / VAT(10%) / 합계, 항목 "CS 쉐어링 서비스 이용료 {년}년 {월}월"
- PDF 미리보기 / Gmail 발송

## 5. HTML 리포트 템플릿 (`src/lib/reportTemplates.ts`)

브랜드 스타일:
- 헤더 배경 `#0D4A55`, 강조 `#C8A96E`
- 커버 / 본문(흰 배경 + KPI + 테이블) / 푸터
- 푸터: "업도움 | uphelpcs@gmail.com | 업도움.com"

`buildWeeklyReportHtml(client, period, stats, settings)` 와 `buildInvoiceHtml(client, year, month, amount)` 두 개 함수.

## 6. 기술 메모

- 모든 금액은 `toLocaleString('ko-KR')`
- 사이드바/디자인 토큰 변경 없음
- 채널톡 API CORS 차단 → 반드시 edge function 경유
- `report_show_tags` 토글이 ON이어도 수집된 태그 0건이면 섹션 자동 숨김

## 발송 방식 확인 필요

"Gmail 발송"이라고 하셨는데, 사용자 본인 Gmail 계정으로 직접 보내려면 Google OAuth 연동이 필요합니다. 빠른 시작을 위해 **Lovable Email(또는 Resend)** 로 "업도움 <발신자>" 형태 발송을 기본 구현하려 합니다. 진짜 Gmail 계정 발송이 꼭 필요하면 별도 OAuth 작업이 추가됩니다.

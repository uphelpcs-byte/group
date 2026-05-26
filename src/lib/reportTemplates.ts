// 업도움 브랜드 리포트 HTML 템플릿

const BRAND = '#0D4A55';
const ACCENT = '#C8A96E';

const fmt = (n: number) => n.toLocaleString('ko-KR');

const baseShell = (innerHtml: string) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>업도움 리포트</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif;color:#222;">
<div style="max-width:800px;margin:0 auto;background:#fff;">
${innerHtml}
</div>
</body>
</html>`;

const footer = () => `
<div style="background:${BRAND};color:#fff;padding:20px;text-align:center;font-size:12px;letter-spacing:0.5px;">
  업도움 &nbsp;|&nbsp; uphelpcs@gmail.com &nbsp;|&nbsp; 업도움.com
</div>`;

const cover = (title: string, subtitle: string) => `
<div style="background:${BRAND};color:#fff;padding:50px 40px;">
  <div style="font-size:14px;color:${ACCENT};letter-spacing:3px;font-weight:bold;margin-bottom:14px;">업도움 · UPHELP</div>
  <div style="font-size:30px;font-weight:bold;margin-bottom:8px;">${title}</div>
  <div style="font-size:15px;opacity:0.85;">${subtitle}</div>
</div>`;

export interface WeeklyStats {
  totalIn: number;
  totalAnswered: number;
  byDay: { date: string; inCount: number; answered: number; avgFirstResponseSec: number | null }[];
  byTag: { tag: string; count: number }[];
}

export interface ReportSettings {
  showTags: boolean;
  showFirstResponse: boolean;
  showResponseRate: boolean;
  topComment?: string | null;
}

const formatSeconds = (sec: number | null) => {
  if (sec == null) return '-';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
};

export function buildWeeklyReportHtml(opts: {
  clientName: string;
  periodStart: string;
  periodEnd: string;
  stats: WeeklyStats;
  settings: ReportSettings;
}) {
  const { clientName, periodStart, periodEnd, stats, settings } = opts;
  const periodLabel = `${periodStart} ~ ${periodEnd}`;
  const responseRate = stats.totalIn > 0 ? Math.round((stats.totalAnswered / stats.totalIn) * 100) : 0;

  const hasTags = settings.showTags && stats.byTag.length > 0;
  const showFR = settings.showFirstResponse;

  const topComment = (settings.topComment || '').trim();
  const commentBlock = topComment ? `
  <div style="margin:24px 0;padding:18px 20px;background:#f9f6ef;border-left:5px solid ${ACCENT};border-radius:4px;">
    <div style="font-size:13px;color:${BRAND};font-weight:bold;margin-bottom:6px;">이번 주 운영 코멘트</div>
    <div style="font-size:14px;line-height:1.7;color:#333;white-space:pre-wrap;">${escapeHtml(topComment)}</div>
  </div>` : '';

  const kpiCard = (label: string, value: string) => `
    <div style="flex:1;background:#fff;border:1px solid #eee;border-radius:8px;padding:24px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <div style="font-size:13px;color:#666;margin-bottom:8px;">${label}</div>
      <div style="font-size:30px;font-weight:bold;color:${BRAND};">${value}</div>
    </div>`;

  const kpiRow = `
  <div style="display:flex;gap:14px;margin:24px 0;">
    ${kpiCard('인입 상담 수', `${fmt(stats.totalIn)}건`)}
    ${kpiCard('응대 상담 수', `${fmt(stats.totalAnswered)}건`)}
    ${settings.showResponseRate ? kpiCard('응대율', `${responseRate}%`) : ''}
  </div>`;

  const dailyRows = stats.byDay
    .map((d) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;">${d.date}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.inCount)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.answered)}</td>
      ${showFR ? `<td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${formatSeconds(d.avgFirstResponseSec)}</td>` : ''}
    </tr>`)
    .join('');

  const dailyTable = `
  <div style="margin:24px 0;">
    <div style="font-size:16px;font-weight:bold;color:${BRAND};margin-bottom:10px;">일별 현황</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:${BRAND};color:#fff;">
          <th style="padding:10px 12px;text-align:left;">날짜</th>
          <th style="padding:10px 12px;text-align:right;">인입 수</th>
          <th style="padding:10px 12px;text-align:right;">응대 수</th>
          ${showFR ? `<th style="padding:10px 12px;text-align:right;">평균 첫 응답</th>` : ''}
        </tr>
      </thead>
      <tbody>${dailyRows || `<tr><td colspan="${showFR ? 4 : 3}" style="padding:20px;text-align:center;color:#999;">데이터 없음</td></tr>`}</tbody>
    </table>
  </div>`;

  const tagsTable = hasTags ? `
  <div style="margin:24px 0;">
    <div style="font-size:16px;font-weight:bold;color:${BRAND};margin-bottom:10px;">태그별 현황</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:${BRAND};color:#fff;">
          <th style="padding:10px 12px;text-align:left;">태그</th>
          <th style="padding:10px 12px;text-align:right;">인입 수</th>
        </tr>
      </thead>
      <tbody>
        ${stats.byTag.map((t) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(t.tag)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${fmt(t.count)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>` : '';

  const body = `
  <div style="padding:30px 40px;background:#fff;">
    ${commentBlock}
    ${kpiRow}
    ${dailyTable}
    ${tagsTable}
  </div>`;

  return baseShell(`${cover(`${clientName} · 주간 CS 리포트`, periodLabel)}${body}${footer()}`);
}

export function buildInvoiceHtml(opts: {
  clientName: string;
  year: number;
  month: number;
  amount: number; // VAT 별도
  businessNumber?: string | null;
}) {
  const { clientName, year, month, amount, businessNumber } = opts;
  const vat = Math.round(amount * 0.1);
  const total = amount + vat;
  const itemName = `CS 쉐어링 서비스 이용료 ${year}년 ${month}월`;

  const body = `
  <div style="padding:30px 40px;background:#fff;">
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;color:#666;">공급받는 자</div>
      <div style="font-size:18px;font-weight:bold;color:${BRAND};margin-top:4px;">${escapeHtml(clientName)}</div>
      ${businessNumber ? `<div style="font-size:12px;color:#888;margin-top:2px;">사업자번호: ${escapeHtml(businessNumber)}</div>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <thead>
        <tr style="background:${BRAND};color:#fff;">
          <th style="padding:12px;text-align:left;">항목</th>
          <th style="padding:12px;text-align:right;width:160px;">금액 (원)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:12px;border-bottom:1px solid #eee;">${escapeHtml(itemName)}</td>
          <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">${fmt(amount)}</td>
        </tr>
        <tr>
          <td style="padding:12px;border-bottom:1px solid #eee;color:#666;">VAT (10%)</td>
          <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;color:#666;">${fmt(vat)}</td>
        </tr>
        <tr>
          <td style="padding:14px 12px;background:#f9f6ef;font-weight:bold;color:${BRAND};">합계</td>
          <td style="padding:14px 12px;background:#f9f6ef;text-align:right;font-weight:bold;color:${BRAND};font-size:18px;">${fmt(total)}</td>
        </tr>
      </tbody>
    </table>

    <div style="font-size:12px;color:#777;line-height:1.7;border-top:1px dashed #ddd;padding-top:14px;">
      · 본 거래명세서는 ${year}년 ${month}월분 서비스 이용료 청구 내역입니다.<br/>
      · 입금 관련 문의는 uphelpcs@gmail.com 으로 연락 부탁드립니다.
    </div>
  </div>`;

  return baseShell(`${cover(`${clientName} · 거래명세서`, `${year}년 ${month}월`)}${body}${footer()}`);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

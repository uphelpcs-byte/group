import { startOfMonth, endOfMonth, parseISO, isWeekend, eachDayOfInterval, format } from 'date-fns';

export interface ProrationInput {
  monthlyFee: number;
  contractStartDate: string | null; // 'YYYY-MM-DD'
  contractEndDate?: string | null;  // 'YYYY-MM-DD'
  billingMonth: string;             // 'YYYY-MM'
}

export interface ProrationResult {
  baseAmount: number;        // 월 계약금액 (VAT 별도)
  billedAmount: number;      // 실제 청구액 (영업일 일할계산 반영)
  isProrated: boolean;
  prorateBusinessDays: number;
  totalBusinessDays: number;
}

/** start~end(포함) 사이의 영업일(주말 제외) 수 */
export function businessDaysInRange(start: Date, end: Date): number {
  if (end < start) return 0;
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
}

/**
 * 영업일 기준 일할계산.
 * - 계약 시작월/종료월이면 시작일~월말 또는 월초~종료일 영업일 비율로 청구.
 * - 시작·종료가 같은 달이면 시작일~종료일 영업일 비율.
 * - 종료일이 이 달 이전이거나 시작일이 이 달 이후면 청구액 0.
 * - 그 외(이미 진행 중)에는 월 계약금액 전액.
 */
export function computeProration({
  monthlyFee,
  contractStartDate,
  contractEndDate,
  billingMonth,
}: ProrationInput): ProrationResult {
  const monthStart = startOfMonth(parseISO(`${billingMonth}-01`));
  const monthEnd = endOfMonth(monthStart);
  const totalBusinessDays = businessDaysInRange(monthStart, monthEnd);
  const base = monthlyFee || 0;

  const start = contractStartDate ? parseISO(contractStartDate) : null;
  const end = contractEndDate ? parseISO(contractEndDate) : null;

  // 계약이 이 달 밖이면 청구 없음
  if ((end && end < monthStart) || (start && start > monthEnd)) {
    return {
      baseAmount: base,
      billedAmount: 0,
      isProrated: false,
      prorateBusinessDays: 0,
      totalBusinessDays,
    };
  }

  // 이 달 내 실제 계약 유효 구간
  const windowStart = start && start > monthStart ? start : monthStart;
  const windowEnd = end && end < monthEnd ? end : monthEnd;
  const startsThisMonth = start != null && format(start, 'yyyy-MM') === billingMonth && start > monthStart;
  const endsThisMonth = end != null && format(end, 'yyyy-MM') === billingMonth && end < monthEnd;
  const isProrated = startsThisMonth || endsThisMonth;

  if (base > 0 && isProrated && totalBusinessDays > 0) {
    const prorateBusinessDays = businessDaysInRange(windowStart, windowEnd);
    const billedAmount = Math.round((base * prorateBusinessDays) / totalBusinessDays);
    return { baseAmount: base, billedAmount, isProrated: true, prorateBusinessDays, totalBusinessDays };
  }

  return {
    baseAmount: base,
    billedAmount: base,
    isProrated: false,
    prorateBusinessDays: totalBusinessDays,
    totalBusinessDays,
  };
}

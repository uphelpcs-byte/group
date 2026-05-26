import { startOfMonth, endOfMonth, parseISO, isWeekend, eachDayOfInterval, format } from 'date-fns';

export interface ProrationInput {
  monthlyFee: number;
  contractStartDate: string | null; // 'YYYY-MM-DD'
  billingMonth: string; // 'YYYY-MM'
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
 * - 계약 시작월이면 시작일~월말 영업일 / 해당 월 전체 영업일 비율로 청구.
 * - 그 외(이미 진행 중)에는 월 계약금액 전액.
 */
export function computeProration({ monthlyFee, contractStartDate, billingMonth }: ProrationInput): ProrationResult {
  const monthStart = startOfMonth(parseISO(`${billingMonth}-01`));
  const monthEnd = endOfMonth(monthStart);
  const totalBusinessDays = businessDaysInRange(monthStart, monthEnd);
  const base = monthlyFee || 0;

  const start = contractStartDate ? parseISO(contractStartDate) : null;
  const startsThisMonth = start != null && format(start, 'yyyy-MM') === billingMonth && start > monthStart;

  if (base > 0 && startsThisMonth && totalBusinessDays > 0) {
    const prorateBusinessDays = businessDaysInRange(start as Date, monthEnd);
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

import { cn } from '@/lib/utils';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  className?: string;
}

const statusStyles: Record<StatusType, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  default: 'bg-muted text-muted-foreground',
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span className={cn('status-badge', statusStyles[status], className)}>
      {label}
    </span>
  );
}

// Contract Status helpers
export function getContractStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <StatusBadge status="success" label="유료 계약" />;
    case 'pilot':
      return <StatusBadge status="warning" label="파일럿" />;
    case 'terminated':
      return <StatusBadge status="error" label="종료" />;
    default:
      return <StatusBadge status="default" label={status} />;
  }
}

// Consultation Status helpers
export function getConsultationStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <StatusBadge status="success" label="완료" />;
    case 'in_progress':
      return <StatusBadge status="info" label="처리중" />;
    case 'pending':
      return <StatusBadge status="warning" label="대기" />;
    case 'escalated':
      return <StatusBadge status="error" label="에스컬레이션" />;
    default:
      return <StatusBadge status="default" label={status} />;
  }
}

// Issue Priority helpers
export function getIssuePriorityBadge(priority: string) {
  switch (priority) {
    case 'critical':
      return <StatusBadge status="error" label="긴급" />;
    case 'high':
      return <StatusBadge status="error" label="높음" />;
    case 'medium':
      return <StatusBadge status="warning" label="보통" />;
    case 'low':
      return <StatusBadge status="default" label="낮음" />;
    default:
      return <StatusBadge status="default" label={priority} />;
  }
}

// Issue Status helpers
export function getIssueStatusBadge(status: string) {
  switch (status) {
    case 'closed':
      return <StatusBadge status="default" label="종료" />;
    case 'resolved':
      return <StatusBadge status="success" label="해결됨" />;
    case 'in_progress':
      return <StatusBadge status="info" label="처리중" />;
    case 'open':
      return <StatusBadge status="warning" label="대기" />;
    default:
      return <StatusBadge status="default" label={status} />;
  }
}

// Task Status helpers
export function getTaskStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <StatusBadge status="success" label="완료" />;
    case 'review':
      return <StatusBadge status="info" label="검토" />;
    case 'in_progress':
      return <StatusBadge status="warning" label="진행중" />;
    case 'pending':
      return <StatusBadge status="default" label="대기" />;
    default:
      return <StatusBadge status="default" label={status} />;
  }
}

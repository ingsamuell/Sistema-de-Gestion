export type CertificateType = 'project' | 'global';

export interface TimeInvestmentCertificate {
  id: string;
  type: CertificateType;
  projectId?: string;
  studentName: string;
  title: string;
  objective?: string;
  totalMinutesInvested: number;
  totalHoursText: string;
  totalTasksCompleted: number;
  totalTasksPlanned: number;
  progressPercent: number;
  isFullyCompleted: boolean;
  issueDate: string;
  formattedIssueDate: string;
  verificationCode: string;
  competencies: string[];
  level: string;
  priority?: string;
}

export interface CertificatesSummary {
  totalMinutesAllProjects: number;
  totalHoursAllProjectsText: string;
  totalCompletedProjects: number;
  totalActiveProjects: number;
  totalTasksCompleted: number;
  certificates: TimeInvestmentCertificate[];
  globalCertificate: TimeInvestmentCertificate | null;
}

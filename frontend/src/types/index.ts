export interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  processed: number;
  isApplicationOpen: boolean;
  siteName?: string;
  announcement?: string;
}

export interface VerificationResponse {
  message: string;
}

export interface ApplicationSubmit {
  email: string;
  code: string; // Verification code
  reason: string;
  deviceId: string;
  securityToken?: string;
  securityAnswer?: string;
}

export interface ApplicationStatus {
  email: string;
  status: string; // pending, approved, rejected
  reason?: string;
  adminNote?: string;
  createdAt: string;
  inviteCode?: string;
}

export interface AdminLoginResponse {
  token: string;
}

export interface ChatMessage {
  id: number;
  senderId: number;
  senderUsername: string;
  senderRole: string;
  senderType: string;
  receiverId?: number;
  receiverUsername?: string;
  message: string;
  quoteId?: number;
  quoteContent?: string;
  isPinned: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export interface ApplicationVote {
  id: number;
  applicationId: number;
  voterId: number;
  voterUsername: string;
  opinion: string;
  comment?: string;
  createdAt: string;
}

export interface AuditorApplication {
  id: number;
  adminId: number;
  username: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  processedBy?: number;
  createdAt: string;
}

export interface AuditorRanking {
  id: number;
  username: string;
  role: string;
  auditCount: number;
  lastAuditAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

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

export interface Setting {
  id: number;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

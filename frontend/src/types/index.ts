export type EmailStatus = "scheduled" | "sent" | "failed";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  slackConnected: boolean;
}

export interface EmailRecord {
  id: string;
  batchId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  status: EmailStatus;
  scheduledTime: string;
  sentTime: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleBatchPayload {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
}

export interface ScheduleBatchResponse {
  batch: {
    id: string;
    subject: string;
    startTime: string;
    delayMs: number;
    hourlyLimit: number;
    totalCount: number;
  };
  emailCount: number;
}

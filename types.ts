export enum SessionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface TranscriptItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isPartial?: boolean;
}

export interface ActionItem {
  assignee: string;
  task: string;
  dueDate?: string;
}

export interface MeetingMinutes {
  title: string;
  date: string;
  attendees: string[];
  summary: string;
  topics: {
    title: string;
    details: string;
  }[];
  decisions: string[];
  actionItems: ActionItem[];
}

export interface LiveSessionHook {
  status: SessionStatus;
  transcript: TranscriptItem[];
  volume: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
  generateMinutes: () => Promise<MeetingMinutes | null>;
  error: string | null;
}
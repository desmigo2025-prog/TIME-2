export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  IMPORTANT = 'Important',
  URGENT = 'Urgent',
  REMINDER = 'Reminder'
}

export enum TaskStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  MISSED = 'Missed'
}

export type ValidationStatus = 'validated' | 'needs_review' | 'user_override';

export interface PasskeyCredential {
    id: string;
    deviceName: string;
    createdAt: string;
}

export interface GoogleIntegration {
    isConnected: boolean;
    email?: string;
    lastSync?: string;
    accessToken?: string; // Encrypted in real backend
}

export interface ExcelIntegration {
    lastUpload?: string;
    fileName?: string;
    totalImported?: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
  isVoice?: boolean;
  groundingMetadata?: any; // For Search Sources
  suggestedAnswers?: string[]; // Quick replies for the user
  emotion?: 'happy' | 'neutral' | 'excited' | 'thinking' | 'serious';
  animation?: 'idle' | 'talking' | 'explaining' | 'greeting' | 'alert';
  popup?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface AISettings {
    backgroundEnabled: boolean;
    memoryEnabled: boolean;
    voiceResponseEnabled: boolean;
    aiAvatarUrl?: string; // Custom AI Image
    aiAvatarType?: 'robot' | 'boy' | 'girl'; // Selected AI Avatar
    dynamicGreetingsEnabled?: boolean; // Context-aware greeting toggle
    natureThemeEnabled?: boolean; // Legacy: Nature color scheme toggle
    theme?: 'dark' | 'nature' | 'ocean' | 'sunset' | 'ladies' | 'white' | 'custom'; // NEW: App theme
    customThemeColor?: string; // Hex color for custom theme
    aiControlEnabled?: boolean; // Allow AI to control app features
    showFloatingAvatar?: boolean; // Show the floating AI avatar
}

export interface AIActionLog {
    id: string;
    actionType: string;
    details: string;
    timestamp: string;
}

export type JobStatus = 'pending' | 'completed' | 'failed';

export interface BackgroundJob {
    id: string;
    jobType: 'REMINDER' | 'TASK_CREATE' | 'NOTIFICATION';
    payload: any;
    scheduledTime: string; // ISO String
    status: JobStatus;
    createdAt: string;
}

export interface LinkRecord {
  id: string;
  url: string;
  dateAdded: string;
  status: 'active' | 'inactive';
  title?: string;
  publishedDate?: string;
  contentSummary?: string;
  newsCategories?: ('news' | 'update' | 'general')[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string; 
  avatarUrl?: string;
  joinedDate: string;
  passkeys?: PasskeyCredential[]; // Kept for legacy compatibility if needed
  passkeyHash?: string; // NEW: 4-Digit Code Hash
  backgroundAlertsEnabled?: boolean; // NEW: Notification Preference
  // Integrations
  googleIntegration?: GoogleIntegration;
  excelIntegration?: ExcelIntegration;
  // Security Fields
  loginAttempts: number;
  lockUntil: number | null; // Timestamp
  lastLoginIP?: string;
  deviceFingerprint?: string;
  // AI Settings
  aiSettings?: AISettings;
  // User-defined announcement link
  announcementLink?: string;
  linkHistory?: LinkRecord[]; // NEW: Link History
  // Pro Membership
  pro_status?: boolean;
  subscription_active?: boolean;
  subscription_date?: string;
  emailSummaryUsed?: boolean;
  // Usage Tracking
  daily_message_count?: number;
  daily_file_upload_count?: number;
  daily_link_count?: number;
  last_reset_date?: string;
}

export interface ParsingMetaData {
    confidence: {
        title: number;
        day: number;
        time: number;
        venue: number;
    };
    correctionsApplied: string[];
    isLowConfidence: boolean;
    originalText?: string;
    detectedLayout?: 'grid' | 'list' | 'columnar';
}

export interface Exam {
  id: string;
  date: string;
  subjects: string[];
  difficultSubjects: string[];
  prioritySubjects?: string[];
}

export interface Task {
  id: string;
  timetableId?: string; 
  title: string;
  description: string;
  day: string; 
  time: string; // "14:00"
  durationMinutes: number;
  venue: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: 'Personal' | 'Work' | 'School' | 'Other';
  isGoogleEvent?: boolean;
  isExcelImport?: boolean;
  // AI & Validation Fields
  confidenceScore?: number; 
  parsingMetaData?: ParsingMetaData; 
  isOverlap?: boolean; 
  validationStatus?: ValidationStatus;
  weekIdentifier?: string; // e.g., "Week 1", "A", "B"
  date?: string; // ISO date string if exact date is known
  rescheduled?: boolean;
  lastUpdatedTime?: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  timestamp: string;
}

export interface ProductivityStat {
  day: string;
  tasksCompleted: number;
  hoursFocused: number;
}

export type SyncStatus = 'synced' | 'saving' | 'error' | 'offline';

export interface TimetableVersion {
    versionId: string;
    timestamp: string;
    tasks: Task[];
    note?: string;
}

// --- Notification System Types ---

export enum AnnouncementType {
  CRITICAL = 'Critical',       // Red: Very Important (Full screen override)
  ANNOUNCEMENT = 'Announcement', // Blue: General News
  ATTENTION = 'Attention',     // Yellow: High Priority
  INFO = 'Info'                // Green: Informative
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  timestamp: string;
  isRead: boolean;
  source?: string; // e.g., "Official WhatsApp Channel"
}

// --- Lecture Recording System Types ---

export type NoteFormat = 'raw_transcript' | 'clean_transcript' | 'full' | 'summary' | 'key_points' | 'keywords' | 'flashcards' | 'multiple_choice' | 'short_answer';

export interface LectureNote {
  id: string;
  lectureId: string;
  format: NoteFormat;
  content: string;
  createdAt: string;
}

export interface Lecture {
  id: string;
  title: string;
  date: string;
  durationSeconds: number;
  audioUrl?: string; // Local blob URL or remote URL
  rawTranscript?: string;
  cleanTranscript?: string;
  transcript?: string; // Legacy
  status: 'recording' | 'processing' | 'completed' | 'error';
  notes: LectureNote[];
}
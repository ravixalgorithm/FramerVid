// Video types
export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'error';

export type AspectRatio = '16/9' | '4/3' | '1/1' | '9/16' | 'custom';
export type ControlStyle = 'show' | 'hide' | 'on-hover';
export type MotionEffect =
  | 'none'
  | 'fade-in'
  | 'scroll-reveal'
  | 'parallax'
  | 'blur-in'
  | 'cinematic'
  | 'hover-play'
  | 'viewport-trigger';

export type ClickAction = 'play-pause' | 'lightbox' | 'none';

export interface VideoSettings {
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  controlsStyle: ControlStyle;
  primaryColor: string; // e.g. '#FF0055'
  brandingLogoUrl?: string;
  brandingPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  endScreenType?: 'image' | 'cta' | 'none';
  endScreenImageUrl?: string;
  privacy: 'public' | 'unlisted' | 'password';
  passwordHash?: string;
  downloadEnabled: boolean;
  playbackSpeeds: number[]; // e.g. [0.5, 1, 1.5, 2]
  
  // Play Button Customization Settings
  playButtonSize?: number;
  playButtonBorderWidth?: number;
  playButtonBorderColor?: string;
  playButtonIconScale?: number;
  playButtonBgTransparent?: boolean;
  
  // Call to Action Settings
  ctaEnabled?: boolean;
  ctaType?: 'button' | 'link';
  ctaText?: string;
  ctaUrl?: string;
  ctaTime?: number | 'end'; // timestamp in seconds, or 'end'
  ctas?: {
    id: string;
    text: string;
    url: string;
    startTime: number;
    duration: number;
    bgColor?: string;
    textColor?: string;
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    position?: 'bottom-center' | 'top-center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center-center';
    leftPercent?: number;
    topPercent?: number;
  }[];
  
  // Lead Capture Form Settings
  formEnabled?: boolean;
  formTime?: number | 'pre-roll' | 'post-roll'; // pre-roll, post-roll, or specific timestamp
  formTitle?: string;
  formDescription?: string;
  formThankYouMessage?: string;
  formButtonText?: string;
  formButtonColor?: string;
  formButtonTextColor?: string;
  formTextColor?: string;
  formBgColor?: string;
  formAlignment?: 'left' | 'center' | 'right';
  formFields?: {
    id: string;
    name: string;
    type: 'email' | 'text' | 'tel';
    required: boolean;
  }[];
  formSkipEnabled?: boolean;
}

export interface Video {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: VideoStatus;
  durationSeconds?: number;
  sizeBytes?: number;
  originalFilename: string;
  hlsManifestUrl?: string;
  thumbnailUrls: string[];
  posterUrl?: string;
  captionsUrl?: string;
  settings: VideoSettings;
  createdAt: Date;
  updatedAt: Date;
}

// Workspace types
export type WorkspacePlan = 'free' | 'starter' | 'pro' | 'agency';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  plan: WorkspacePlan;
  storageUsedBytes: number;
  bandwidthUsedBytes: number;
  createdAt: Date;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: 'admin' | 'editor' | 'viewer';
  invitedAt: Date;
  acceptedAt?: Date;
}

// Folder types
export interface Folder {
  id: string;
  workspaceId: string;
  name: string;
  parentFolderId?: string;
  createdAt: Date;
}

// Custom Authentication & User types (Replacing Clerk)
export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface SignupRequest {
  email: string;
  password?: string; // Optional if doing passwordless or password-based
  name?: string;
}

export interface SigninRequest {
  email: string;
  password?: string;
}

// Analytics types
export type VideoEventType =
  | 'video_play'
  | 'video_pause'
  | 'video_progress'
  | 'video_complete'
  | 'video_seek'
  | 'lightbox_open'
  | 'form_view'
  | 'form_submit'
  | 'cta_click';

export interface VideoEventPayload {
  videoId: string;
  workspaceId?: string;
  trackingLabel?: string;
  eventType: VideoEventType;
  progressPct?: number; // 0 to 100
  sessionId?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  country?: string;
  referrerDomain?: string;
  timestamp: string; // ISO String
  eventData?: Record<string, any>; // Arbitrary data like { email: '...' }
}

// API Responses
export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
}

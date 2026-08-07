export interface UploadedFileInfo {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  shareUrl: string;
  downloaded?: boolean;
  downloadedAt?: string;
  expired?: boolean;
  expiredAt?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface OperationLog {
  id: string;
  timestamp: string;
  action: 'UPLOAD' | 'DOWNLOAD' | 'REMOVE' | 'ERROR';
  details: string;
  success: boolean;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileExtensionColor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'pdf':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'mkv':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    case 'doc':
    case 'docx':
    case 'txt':
    case 'md':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  }
}

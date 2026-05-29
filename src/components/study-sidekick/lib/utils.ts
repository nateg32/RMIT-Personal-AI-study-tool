import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ViewType = 'dashboard' | 'assignments' | 'courses' | 'announcements' | 'files' | 'sessions' | 'chat' | 'settings';

import { UserRole } from './user.model';

export interface UserProfile {
  id?: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  skills: string;
  profileImageUrl: string;
}

export interface Mentor {
  id: number;
  name: string;
  bio: string;
  skills: string;
  experience: string;
  rating: number;
  hourlyRate: number;
  availability: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  userId: number;
}

export interface MentorFilters {
  skill?: string;
  minRating?: number | null;
  experience?: string;
  maxPrice?: number | null;
  availability?: string;
}

export interface Skill {
  id?: number;
  name: string;
  category: string;
}

export interface SessionRecord {
  id?: number;
  mentorId: number;
  learnerId: number;
  sessionDate: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
}

export interface GroupRecord {
  id?: number;
  name: string;
  description: string;
  createdBy: number;
  createdAt?: string;
}

export interface GroupMember {
  id: number;
  groupId: number;
  userId: number;
  joinedAt: string;
}

export interface GroupMessage {
  id: number;
  groupId: number;
  userId: number;
  content: string;
  createdAt: string;
}

export interface CreateGroupMessageRequest {
  userId: number;
  content: string;
}

export interface Review {
  id?: number;
  mentorId: number;
  userId: number;
  rating: number;
  comment: string;
  createdAt?: string;
}

export interface DashboardStat {
  label: string;
  value: string;
  detail: string;
  tone: 'sun' | 'sea' | 'leaf' | 'ink';
}

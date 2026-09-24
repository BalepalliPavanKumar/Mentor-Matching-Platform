export type UserRole = 'ROLE_LEARNER' | 'ROLE_MENTOR' | 'ROLE_ADMIN';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateGroupMessageRequest,
  GroupMember,
  GroupMessage,
  GroupRecord,
  Mentor,
  MentorFilters,
  Review,
  SessionRecord,
  Skill,
  UserProfile,
} from '../models/platform.model';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  getUserProfiles(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(this.api.endpoint('/users'));
  }

  getUserProfile(profileId: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.api.endpoint(`/users/${profileId}`));
  }

  createUserProfile(profile: UserProfile): Observable<UserProfile> {
    return this.http.post<UserProfile>(this.api.endpoint('/users'), profile);
  }

  updateUserProfile(profileId: number, profile: UserProfile): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.api.endpoint(`/users/${profileId}`), profile);
  }

  getMentors(filters?: MentorFilters): Observable<Mentor[]> {
    let params = new HttpParams();

    if (filters?.skill) {
      params = params.set('skill', filters.skill);
    }
    if (filters?.minRating != null) {
      params = params.set('minRating', filters.minRating);
    }
    if (filters?.experience) {
      params = params.set('experience', filters.experience);
    }
    if (filters?.maxPrice != null) {
      params = params.set('maxPrice', filters.maxPrice);
    }
    if (filters?.availability) {
      params = params.set('availability', filters.availability);
    }

    return this.http.get<Mentor[]>(this.api.endpoint('/mentors'), { params });
  }

  getMentor(mentorId: number): Observable<Mentor> {
    return this.http.get<Mentor>(this.api.endpoint(`/mentors/${mentorId}`));
  }

  addMentor(mentor: Mentor): Observable<Mentor> {
    return this.http.post<Mentor>(this.api.endpoint('/mentors'), mentor);
  }

  getPendingMentors(): Observable<Mentor[]> {
    return this.http.get<Mentor[]>(this.api.endpoint('/mentors/pending'));
  }

  applyAsMentor(mentor: Omit<Mentor, 'id' | 'rating' | 'status'> & Partial<Pick<Mentor, 'status' | 'rating'>>): Observable<Mentor> {
    return this.http.post<Mentor>(this.api.endpoint('/mentors/apply'), mentor);
  }

  updateMentorAvailability(mentorId: number, availability: string): Observable<Mentor> {
    const params = new HttpParams().set('availability', availability);
    return this.http.put<Mentor>(this.api.endpoint(`/mentors/${mentorId}/availability`), null, { params });
  }

  approveMentor(mentorId: number): Observable<Mentor> {
    return this.http.put<Mentor>(this.api.endpoint(`/mentors/${mentorId}/approve`), null);
  }

  rejectMentor(mentorId: number): Observable<Mentor> {
    return this.http.put<Mentor>(this.api.endpoint(`/mentors/${mentorId}/reject`), null);
  }

  getSkills(): Observable<Skill[]> {
    return this.http.get<Skill[]>(this.api.endpoint('/skills'));
  }

  getSkill(skillId: number): Observable<Skill> {
    return this.http.get<Skill>(this.api.endpoint(`/skills/${skillId}`));
  }

  createSkill(skill: Skill): Observable<Skill> {
    return this.http.post<Skill>(this.api.endpoint('/skills'), skill);
  }

  getSession(sessionId: number): Observable<SessionRecord> {
    return this.http.get<SessionRecord>(this.api.endpoint(`/sessions/${sessionId}`));
  }

  getSessionsForUser(userId: number): Observable<SessionRecord[]> {
    return this.http.get<SessionRecord[]>(this.api.endpoint(`/sessions/user/${userId}`));
  }

  createSession(session: Omit<SessionRecord, 'id' | 'status'> & Partial<Pick<SessionRecord, 'status'>>): Observable<SessionRecord> {
    return this.http.post<SessionRecord>(this.api.endpoint('/sessions'), session);
  }

  acceptSession(sessionId: number): Observable<SessionRecord> {
    return this.http.put<SessionRecord>(this.api.endpoint(`/sessions/${sessionId}/accept`), null);
  }

  rejectSession(sessionId: number): Observable<SessionRecord> {
    return this.http.put<SessionRecord>(this.api.endpoint(`/sessions/${sessionId}/reject`), null);
  }

  cancelSession(sessionId: number): Observable<SessionRecord> {
    return this.http.put<SessionRecord>(this.api.endpoint(`/sessions/${sessionId}/cancel`), null);
  }

  completeSession(sessionId: number): Observable<SessionRecord> {
    return this.http.put<SessionRecord>(this.api.endpoint(`/sessions/${sessionId}/complete`), null);
  }

  remindSession(sessionId: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(this.api.endpoint(`/sessions/${sessionId}/remind`), null);
  }

  getGroups(): Observable<GroupRecord[]> {
    return this.http.get<GroupRecord[]>(this.api.endpoint('/groups'));
  }

  getGroup(groupId: number): Observable<GroupRecord> {
    return this.http.get<GroupRecord>(this.api.endpoint(`/groups/${groupId}`));
  }

  createGroup(group: GroupRecord): Observable<GroupRecord> {
    return this.http.post<GroupRecord>(this.api.endpoint('/groups'), group);
  }

  joinGroup(groupId: number, userId: number): Observable<GroupMember> {
    const params = new HttpParams().set('userId', userId);
    return this.http.post<GroupMember>(this.api.endpoint(`/groups/${groupId}/join`), null, { params });
  }

  leaveGroup(groupId: number, userId: number): Observable<void> {
    const params = new HttpParams().set('userId', userId);
    return this.http.post<void>(this.api.endpoint(`/groups/${groupId}/leave`), null, { params });
  }

  getGroupMembers(groupId: number): Observable<GroupMember[]> {
    return this.http.get<GroupMember[]>(this.api.endpoint(`/groups/${groupId}/members`));
  }

  getGroupMessages(groupId: number): Observable<GroupMessage[]> {
    return this.http.get<GroupMessage[]>(this.api.endpoint(`/groups/${groupId}/messages`));
  }

  postGroupMessage(groupId: number, request: CreateGroupMessageRequest): Observable<GroupMessage> {
    return this.http.post<GroupMessage>(this.api.endpoint(`/groups/${groupId}/messages`), request);
  }

  getMentorReviews(mentorId: number): Observable<Review[]> {
    return this.http.get<Review[]>(this.api.endpoint(`/reviews/mentor/${mentorId}`));
  }

  getReview(reviewId: number): Observable<Review> {
    return this.http.get<Review>(this.api.endpoint(`/reviews/${reviewId}`));
  }

  getMentorAverageRating(mentorId: number): Observable<number> {
    return this.http.get<number>(this.api.endpoint(`/reviews/mentor/${mentorId}/average`));
  }

  submitReview(review: Review): Observable<Review> {
    return this.http.post<Review>(this.api.endpoint('/reviews'), review);
  }
}

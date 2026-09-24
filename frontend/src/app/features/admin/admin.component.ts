import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import {
  GroupMember,
  GroupMessage,
  GroupRecord,
  Mentor,
  Review,
  SessionRecord,
  Skill,
  UserProfile,
} from '../../core/models/platform.model';
import { PlatformService } from '../../core/services/platform.service';
import { avatarColor, initialsOf } from '../../shared/utils/avatar-color';

type LookupKind = 'user' | 'mentor' | 'skill' | 'session' | 'group' | 'review';

interface ActivityItem {
  icon: string;
  title: string;
  detail: string;
  tone: 'good' | 'warn' | 'info' | 'danger';
}

interface Kpi {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone: 'red' | 'blue' | 'green' | 'gold';
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly platformService = inject(PlatformService);

  readonly nowDate = new Date();
  readonly loading = signal(true);
  readonly users = signal<UserProfile[]>([]);
  readonly mentors = signal<Mentor[]>([]);
  readonly pendingMentors = signal<Mentor[]>([]);
  readonly skills = signal<Skill[]>([]);
  readonly groups = signal<GroupRecord[]>([]);
  readonly membersByGroup = signal<Record<number, GroupMember[]>>({});
  readonly messagesByGroup = signal<Record<number, GroupMessage[]>>({});
  readonly sessionsByUser = signal<Record<number, SessionRecord[]>>({});
  readonly reviewsByMentor = signal<Record<number, Review[]>>({});
  readonly averageByMentor = signal<Record<number, number>>({});
  readonly selectedUser = signal<UserProfile | null>(null);
  readonly selectedGroup = signal<GroupRecord | null>(null);
  readonly selectedLookup = signal<unknown | null>(null);
  readonly lookupLabel = signal('');

  readonly userForm = this.fb.group({
    id: [null as number | null],
    userId: [null as number | null, Validators.required],
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    role: ['ROLE_LEARNER', Validators.required],
    skills: [''],
    profileImageUrl: ['']
  });

  readonly skillForm = this.fb.group({
    name: ['', Validators.required],
    category: ['', Validators.required]
  });

  readonly groupForm = this.fb.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    createdBy: [null as number | null, Validators.required]
  });

  readonly messageForm = this.fb.group({
    userId: [null as number | null, Validators.required],
    content: ['', Validators.required]
  });

  readonly lookupForm = this.fb.group({
    kind: ['user' as LookupKind, Validators.required],
    id: [null as number | null, Validators.required]
  });

  readonly kpis = computed<Kpi[]>(() => {
    const sessions = this.allSessions();
    const reviews = this.allReviews();
    const activeMentors = this.mentors().filter((mentor) => mentor.status === 'APPROVED');
    const revenue = sessions.filter((session) => session.status === 'COMPLETED').length * 1200;

    return [
      {
        label: 'Total Users',
        value: this.users().length.toString(),
        detail: `${this.users().filter((user) => user.role === 'ROLE_LEARNER').length} learners on platform`,
        icon: 'groups',
        tone: 'red'
      },
      {
        label: 'Active Mentors',
        value: activeMentors.length.toString(),
        detail: `${this.pendingMentors().length} applications pending`,
        icon: 'workspace_premium',
        tone: 'blue'
      },
      {
        label: 'Sessions Booked',
        value: sessions.length.toString(),
        detail: `${sessions.filter((session) => session.status === 'ACCEPTED').length} accepted sessions`,
        icon: 'event_available',
        tone: 'green'
      },
      {
        label: 'Review Score',
        value: this.platformAverage().toFixed(1),
        detail: `${reviews.length} submitted mentor reviews`,
        icon: 'star',
        tone: 'gold'
      },
    ];
  });

  readonly allSessions = computed(() => Object.values(this.sessionsByUser()).flat());
  readonly allReviews = computed(() => Object.values(this.reviewsByMentor()).flat());

  readonly platformAverage = computed(() => {
    const averages = Object.values(this.averageByMentor()).filter((value) => value > 0);
    if (!averages.length) {
      return 0;
    }
    return averages.reduce((total, value) => total + value, 0) / averages.length;
  });

  readonly completionRate = computed(() => this.percent(
    this.allSessions().filter((session) => session.status === 'COMPLETED').length,
    this.allSessions().length
  ));

  readonly satisfactionRate = computed(() => Math.round((this.platformAverage() / 5) * 100));

  readonly engagementRate = computed(() => this.percent(
    Object.values(this.membersByGroup()).flat().length,
    Math.max(this.users().length, 1)
  ));

  readonly retentionRate = computed(() => this.percent(
    this.users().filter((user) => this.sessionsByUser()[user.userId]?.length || this.sessionsByUser()[user.id ?? -1]?.length).length,
    this.users().length
  ));

  readonly recentActivity = computed<ActivityItem[]>(() => {
    const pending = this.pendingMentors().slice(0, 2).map((mentor) => ({
      icon: 'hourglass_top',
      title: `${mentor.name} is waiting for mentor approval`,
      detail: `${mentor.skills || 'No skill tags'} | ${mentor.experience || 'Experience not set'}`,
      tone: 'warn' as const
    }));

    const sessions = this.allSessions().slice(-3).reverse().map((session) => ({
      icon: 'calendar_month',
      title: `Session #${session.id ?? 'new'} is ${session.status}`,
      detail: `Learner ${session.learnerId} with mentor ${session.mentorId}`,
      tone: session.status === 'CANCELLED' || session.status === 'REJECTED' ? 'danger' as const : 'info' as const
    }));

    const reviews = this.allReviews().slice(-2).reverse().map((review) => ({
      icon: 'reviews',
      title: `${review.rating}/5 review submitted`,
      detail: `Mentor ${review.mentorId} by user ${review.userId}`,
      tone: 'good' as const
    }));

    return [...pending, ...sessions, ...reviews].slice(0, 6);
  });

  ngOnInit(): void {
    void this.loadPage();
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);

    const [users, mentors, pendingMentors, skills, groups] = await Promise.all([
      this.safeFirst(this.platformService.getUserProfiles(), []),
      this.safeFirst(this.platformService.getMentors(), []),
      this.safeFirst(this.platformService.getPendingMentors(), []),
      this.safeFirst(this.platformService.getSkills(), []),
      this.safeFirst(this.platformService.getGroups(), [])
    ]);

    this.users.set(users);
    this.mentors.set(mentors);
    this.pendingMentors.set(pendingMentors);
    this.skills.set(skills);
    this.groups.set(groups);
    this.selectedGroup.set(groups[0] ?? null);

    await Promise.all([
      this.loadGroupDetails(groups),
      this.loadSessionOverview(users),
      this.loadReviewOverview(mentors)
    ]);

    if (!this.selectedUser() && users[0]) {
      this.selectUser(users[0]);
    }

    this.loading.set(false);
  }

  selectUser(user: UserProfile): void {
    this.selectedUser.set(user);
    this.userForm.patchValue({
      id: user.id ?? null,
      userId: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      skills: user.skills ?? '',
      profileImageUrl: user.profileImageUrl ?? ''
    });
  }

  async saveUser(): Promise<void> {
    if (this.userForm.invalid) {
      return;
    }

    const payload = this.userForm.getRawValue() as UserProfile;
    if (payload.id) {
      await firstValueFrom(this.platformService.updateUserProfile(payload.id, payload));
      this.snackBar.open('User profile updated.', 'Close', { duration: 3000 });
    } else {
      await firstValueFrom(this.platformService.createUserProfile(payload));
      this.snackBar.open('User profile created.', 'Close', { duration: 3000 });
    }

    this.userForm.reset({ role: 'ROLE_LEARNER' });
    await this.loadPage();
  }

  startNewUser(): void {
    this.selectedUser.set(null);
    this.userForm.reset({ role: 'ROLE_LEARNER' });
  }

  async createSkill(): Promise<void> {
    if (this.skillForm.invalid) {
      return;
    }

    await firstValueFrom(this.platformService.createSkill(this.skillForm.getRawValue() as Skill));
    this.skillForm.reset();
    this.snackBar.open('Skill added to catalog.', 'Close', { duration: 3000 });
    await this.loadPage();
  }

  async createGroup(): Promise<void> {
    if (this.groupForm.invalid) {
      return;
    }

    await firstValueFrom(this.platformService.createGroup(this.groupForm.getRawValue() as GroupRecord));
    this.groupForm.reset();
    this.snackBar.open('Learning group created.', 'Close', { duration: 3000 });
    await this.loadPage();
  }

  async selectGroup(group: GroupRecord): Promise<void> {
    this.selectedGroup.set(group);
    if (!group.id) {
      return;
    }

    const [members, messages] = await Promise.all([
      this.safeFirst(this.platformService.getGroupMembers(group.id), []),
      this.safeFirst(this.platformService.getGroupMessages(group.id), [])
    ]);

    this.membersByGroup.set({ ...this.membersByGroup(), [group.id]: members });
    this.messagesByGroup.set({ ...this.messagesByGroup(), [group.id]: messages });
  }

  async postGroupMessage(): Promise<void> {
    const groupId = this.selectedGroup()?.id;
    if (!groupId || this.messageForm.invalid) {
      return;
    }

    await firstValueFrom(this.platformService.postGroupMessage(groupId, this.messageForm.getRawValue() as { userId: number; content: string }));
    this.messageForm.reset();
    this.snackBar.open('Group moderation message posted.', 'Close', { duration: 3000 });
    await this.selectGroup(this.selectedGroup()!);
  }

  async moderateMentor(mentor: Mentor, action: 'approve' | 'reject'): Promise<void> {
    if (!mentor.id) {
      return;
    }

    if (action === 'approve') {
      await firstValueFrom(this.platformService.approveMentor(mentor.id));
    } else {
      await firstValueFrom(this.platformService.rejectMentor(mentor.id));
    }

    this.snackBar.open(`Mentor ${action}d.`, 'Close', { duration: 3000 });
    await this.loadPage();
  }

  async updateSession(session: SessionRecord, action: 'accept' | 'reject' | 'cancel' | 'complete' | 'remind'): Promise<void> {
    if (!session.id) {
      return;
    }

    if (action === 'accept') {
      await firstValueFrom(this.platformService.acceptSession(session.id));
    } else if (action === 'reject') {
      await firstValueFrom(this.platformService.rejectSession(session.id));
    } else if (action === 'cancel') {
      await firstValueFrom(this.platformService.cancelSession(session.id));
    } else if (action === 'complete') {
      await firstValueFrom(this.platformService.completeSession(session.id));
    } else {
      await firstValueFrom(this.platformService.remindSession(session.id));
    }
    this.snackBar.open(`Session ${action} action sent.`, 'Close', { duration: 3000 });
    await this.loadPage();
  }

  async runLookup(): Promise<void> {
    const { kind, id } = this.lookupForm.getRawValue();
    if (!kind || !id) {
      return;
    }

    if (kind === 'user') {
      this.selectedLookup.set(await firstValueFrom(this.platformService.getUserProfile(id)));
    } else if (kind === 'mentor') {
      this.selectedLookup.set(await firstValueFrom(this.platformService.getMentor(id)));
    } else if (kind === 'skill') {
      this.selectedLookup.set(await firstValueFrom(this.platformService.getSkill(id)));
    } else if (kind === 'session') {
      this.selectedLookup.set(await firstValueFrom(this.platformService.getSession(id)));
    } else if (kind === 'group') {
      this.selectedLookup.set(await firstValueFrom(this.platformService.getGroup(id)));
    } else {
      this.selectedLookup.set(await firstValueFrom(this.platformService.getReview(id)));
    }
    this.lookupLabel.set(`${kind} #${id}`);
  }

  sessionsForUser(user: UserProfile): SessionRecord[] {
    return this.sessionsByUser()[user.userId] ?? this.sessionsByUser()[user.id ?? -1] ?? [];
  }

  membersFor(groupId: number | undefined): GroupMember[] {
    return groupId ? this.membersByGroup()[groupId] ?? [] : [];
  }

  messagesFor(groupId: number | undefined): GroupMessage[] {
    return groupId ? this.messagesByGroup()[groupId] ?? [] : [];
  }

  reviewsFor(mentorId: number): Review[] {
    return this.reviewsByMentor()[mentorId] ?? [];
  }

  private async loadGroupDetails(groups: GroupRecord[]): Promise<void> {
    if (!groups.length) {
      this.membersByGroup.set({});
      this.messagesByGroup.set({});
      return;
    }

    const details = await firstValueFrom(
      forkJoin(groups.map((group) => forkJoin({
        members: this.platformService.getGroupMembers(group.id!).pipe(catchError(() => of([] as GroupMember[]))),
        messages: this.platformService.getGroupMessages(group.id!).pipe(catchError(() => of([] as GroupMessage[])))
      })))
    );

    this.membersByGroup.set(details.reduce<Record<number, GroupMember[]>>((acc, detail, index) => {
      acc[groups[index].id!] = detail.members;
      return acc;
    }, {}));
    this.messagesByGroup.set(details.reduce<Record<number, GroupMessage[]>>((acc, detail, index) => {
      acc[groups[index].id!] = detail.messages;
      return acc;
    }, {}));
  }

  private async loadSessionOverview(users: UserProfile[]): Promise<void> {
    if (!users.length) {
      this.sessionsByUser.set({});
      return;
    }

    const sessions = await firstValueFrom(
      forkJoin(users.map((user) => {
        const userId = user.userId || user.id;
        return this.platformService.getSessionsForUser(userId!).pipe(catchError(() => of([] as SessionRecord[])));
      }))
    );

    this.sessionsByUser.set(sessions.reduce<Record<number, SessionRecord[]>>((acc, records, index) => {
      const userId = users[index].userId || users[index].id;
      if (userId) {
        acc[userId] = records;
      }
      return acc;
    }, {}));
  }

  private async loadReviewOverview(mentors: Mentor[]): Promise<void> {
    const mentorsWithIds = mentors.filter((mentor) => mentor.id);
    if (!mentorsWithIds.length) {
      this.reviewsByMentor.set({});
      this.averageByMentor.set({});
      return;
    }

    const reviews = await firstValueFrom(
      forkJoin(mentorsWithIds.map((mentor) => forkJoin({
        reviews: this.platformService.getMentorReviews(mentor.id).pipe(catchError(() => of([] as Review[]))),
        average: this.platformService.getMentorAverageRating(mentor.id).pipe(catchError(() => of(mentor.rating ?? 0)))
      })))
    );

    this.reviewsByMentor.set(reviews.reduce<Record<number, Review[]>>((acc, detail, index) => {
      acc[mentorsWithIds[index].id] = detail.reviews;
      return acc;
    }, {}));
    this.averageByMentor.set(reviews.reduce<Record<number, number>>((acc, detail, index) => {
      acc[mentorsWithIds[index].id] = detail.average;
      return acc;
    }, {}));
  }

  private async safeFirst<T>(source: Observable<T>, fallback: T): Promise<T> {
    try {
      return await firstValueFrom(source);
    } catch {
      return fallback;
    }
  }

  private percent(value: number, total: number): number {
    if (!total) {
      return 0;
    }
    return Math.min(100, Math.round((value / total) * 100));
  }

  initials(name: string): string {
    return initialsOf(name);
  }

  avatarBg(seed: string): string {
    return avatarColor(seed);
  }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { DashboardStat, GroupRecord, Mentor, SessionRecord } from '../../core/models/platform.model';
import { PlatformService } from '../../core/services/platform.service';
import { avatarColor, initialsOf } from '../../shared/utils/avatar-color';
import { skillList } from '../../shared/utils/skills';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private readonly platformService = inject(PlatformService);
  readonly authStore = inject(AuthStore);

  readonly loading = signal(true);
  readonly mentors = signal<Mentor[]>([]);
  readonly sessions = signal<SessionRecord[]>([]);
  readonly groups = signal<GroupRecord[]>([]);
  readonly backendNotes = signal<string[]>([]);

  readonly stats = computed<DashboardStat[]>(() => {
    const sessions = this.sessions();
    const mentors = this.mentors();
    const groups = this.groups();
    const acceptedSessions = sessions.filter((session) => session.status === 'ACCEPTED');

    return [
      {
        label: 'Approved mentors',
        value: mentors.length.toString(),
        detail: 'Available for learner discovery',
        tone: 'sun'
      },
      {
        label: 'Your sessions',
        value: sessions.length.toString(),
        detail: `${acceptedSessions.length} accepted right now`,
        tone: 'sea'
      },
      {
        label: 'Peer groups',
        value: groups.length.toString(),
        detail: 'Open learning communities',
        tone: 'leaf'
      },
      {
        label: 'Current role',
        value: this.authStore.displayRole(),
        detail: 'Personalized workspace',
        tone: 'ink'
      }
    ];
  });

  readonly recommendedMentors = computed(() => this.mentors().slice().sort((a, b) => b.rating - a.rating).slice(0, 3));
  readonly upcomingSessions = computed(() => this.sessions().slice().sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)).slice(0, 4));

  private readonly statIcons: Record<string, string> = {
    sun: 'calendar_today',
    sea: 'diversity_3',
    leaf: 'groups',
    ink: 'military_tech'
  };

  statIcon(tone: string): string {
    return this.statIcons[tone] ?? 'insights';
  }

  mentorName(mentorId: number): string {
    return this.mentors().find((mentor) => mentor.id === mentorId)?.name ?? `Mentor #${mentorId}`;
  }

  initials(name: string): string {
    return initialsOf(name);
  }

  avatarBg(seed: string): string {
    return avatarColor(seed);
  }

  skills(mentor: Mentor): string[] {
    return skillList(mentor.skills);
  }

  ngOnInit(): void {
    void this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    const userId = this.authStore.user()?.id;

    if (!userId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.backendNotes.set([]);

    forkJoin({
      mentors: this.platformService.getMentors(),
      sessions: this.platformService.getSessionsForUser(userId),
      groups: this.platformService.getGroups()
    }).subscribe({
      next: ({ mentors, sessions, groups }) => {
        this.mentors.set(mentors);
        this.sessions.set(sessions);
        this.groups.set(groups);

        this.backendNotes.set([]);
        this.loading.set(false);
      },
      error: () => {
        this.backendNotes.set(['Dashboard data could not be loaded right now. If this persists after re-login, refresh once and verify the backend stack is up.']);
        this.loading.set(false);
      }
    });
  }
}

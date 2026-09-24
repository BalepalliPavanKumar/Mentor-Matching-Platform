import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { Mentor, SessionRecord } from '../../core/models/platform.model';
import { PlatformService } from '../../core/services/platform.service';
import { avatarColor, initialsOf } from '../../shared/utils/avatar-color';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatStepperModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatSelectModule,
    MatCardModule,
    MatSnackBarModule
  ],
  templateUrl: './sessions.component.html',
  styleUrls: ['./sessions.component.scss']
})
export class SessionsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly platformService = inject(PlatformService);
  readonly authStore = inject(AuthStore);

  readonly firstFormGroup = this.fb.group({
    mentorId: [null as number | null, Validators.required],
    date: [null as Date | null, Validators.required]
  });
  readonly secondFormGroup = this.fb.group({
    time: ['', Validators.required],
    duration: [60, Validators.required],
    topic: ['']
  });
  readonly thirdFormGroup = this.fb.group({
    confirm: [true]
  });

  readonly mentors = signal<Mentor[]>([]);
  readonly sessions = signal<SessionRecord[]>([]);
  readonly loading = signal(true);

  readonly timeSlots = ['09:00', '10:30', '11:00', '14:00', '15:30', '17:00'];
  readonly durations = [30, 60, 90];

  readonly selectedMentor = computed(() =>
    this.mentors().find((mentor) => mentor.id === this.firstFormGroup.value.mentorId) ?? null
  );

  readonly estimatedTotal = computed(() => {
    const mentor = this.selectedMentor();
    const duration = this.secondFormGroup.value.duration ?? 60;
    if (!mentor) {
      return 0;
    }
    return Math.round(mentor.hourlyRate * (duration / 60));
  });

  dateHasSlots = (date: Date): string => {
    const day = date.getDay();
    return day === 0 ? '' : 'has-slots';
  };

  initials(name: string): string {
    return initialsOf(name);
  }

  avatarBg(seed: string): string {
    return avatarColor(seed);
  }

  ngOnInit(): void {
    void this.loadPage();

    this.route.queryParamMap.subscribe((params) => {
      const mentorId = Number(params.get('mentor'));
      if (mentorId) {
        this.firstFormGroup.patchValue({ mentorId });
      }
    });
  }

  async loadPage(): Promise<void> {
    const userId = this.authStore.user()?.id;
    if (!userId) {
      this.loading.set(false);
      return;
    }

    forkJoin({
      mentors: this.platformService.getMentors(),
      sessions: this.platformService.getSessionsForUser(userId)
    }).subscribe({
      next: ({ mentors, sessions }) => {
        this.mentors.set(mentors);
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  async confirmBooking(): Promise<void> {
    if (this.firstFormGroup.invalid || this.secondFormGroup.invalid) {
      return;
    }

    const userId = this.authStore.user()?.id;
    const { mentorId, date } = this.firstFormGroup.getRawValue();
    const { time } = this.secondFormGroup.getRawValue();

    if (!userId || !mentorId || !date || !time) {
      return;
    }

    const [hours, minutes] = time.split(':').map(Number);
    const sessionDate = new Date(date);
    sessionDate.setHours(hours, minutes, 0, 0);

    await firstValueFrom(
      this.platformService.createSession({
        mentorId,
        learnerId: userId,
        sessionDate: sessionDate.toISOString()
      })
    );

    this.snackBar.open('Session request created.', 'Close', { duration: 3000 });
    this.firstFormGroup.reset();
    this.secondFormGroup.reset();
    this.thirdFormGroup.reset();
    await this.loadPage();
    void this.router.navigate([], { queryParams: {} });
  }

  async updateStatus(session: SessionRecord, action: 'cancel' | 'complete' | 'remind'): Promise<void> {
    if (!session.id) {
      return;
    }

    if (action === 'cancel') {
      await firstValueFrom(this.platformService.cancelSession(session.id));
    } else if (action === 'complete') {
      await firstValueFrom(this.platformService.completeSession(session.id));
    } else {
      await firstValueFrom(this.platformService.remindSession(session.id));
    }

    this.snackBar.open(`Session ${action} action sent.`, 'Close', { duration: 3000 });
    await this.loadPage();
  }
}

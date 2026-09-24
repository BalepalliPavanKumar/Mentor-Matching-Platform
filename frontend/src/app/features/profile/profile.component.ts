import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { Mentor, UserProfile } from '../../core/models/platform.model';
import { PlatformService } from '../../core/services/platform.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly platformService = inject(PlatformService);
  readonly authStore = inject(AuthStore);

  readonly profileForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    skills: [''],
    profileImageUrl: ['']
  });

  readonly mentorForm = this.fb.group({
    bio: ['', Validators.required],
    skills: ['', Validators.required],
    experience: ['', Validators.required],
    hourlyRate: [500, Validators.required],
    availability: ['']
  });

  readonly profileRecord = signal<UserProfile | null>(null);
  readonly mentorRecord = signal<Mentor | null>(null);
  readonly canApplyAsMentor = computed(() => this.authStore.user()?.role !== 'ROLE_ADMIN');

  ngOnInit(): void {
    void this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    const user = this.authStore.user();
    if (!user) {
      return;
    }

    const [profiles, mentors] = await Promise.all([
      firstValueFrom(this.platformService.getUserProfiles()),
      firstValueFrom(this.platformService.getMentors())
    ]);

    const existingProfile = profiles.find((profile) => profile.userId === user.id) ?? null;
    const existingMentor = mentors.find((mentor) => mentor.userId === user.id) ?? null;

    this.profileRecord.set(existingProfile);
    this.mentorRecord.set(existingMentor);

    this.profileForm.patchValue({
      name: existingProfile?.name ?? user.name,
      email: existingProfile?.email ?? user.email,
      phone: existingProfile?.phone ?? '',
      skills: existingProfile?.skills ?? '',
      profileImageUrl: existingProfile?.profileImageUrl ?? ''
    });

    if (existingMentor) {
      this.mentorForm.patchValue({
        bio: existingMentor.bio,
        skills: existingMentor.skills,
        experience: existingMentor.experience,
        hourlyRate: existingMentor.hourlyRate,
        availability: existingMentor.availability
      });
    }
  }

  async saveProfile(): Promise<void> {
    const user = this.authStore.user();
    if (!user || this.profileForm.invalid) {
      return;
    }

    const payload: UserProfile = {
      ...(this.profileRecord() ?? {}),
      userId: user.id,
      role: user.role,
      ...this.profileForm.getRawValue()
    } as UserProfile;

    if (this.profileRecord()?.id) {
      await firstValueFrom(this.platformService.updateUserProfile(this.profileRecord()!.id!, payload));
    } else {
      await firstValueFrom(this.platformService.createUserProfile(payload));
    }

    this.snackBar.open('Profile saved.', 'Close', { duration: 3000 });
    await this.loadProfile();
  }

  async saveMentorStatus(): Promise<void> {
    const user = this.authStore.user();
    if (!user || this.mentorForm.invalid || !this.canApplyAsMentor()) {
      return;
    }

    const currentMentor = this.mentorRecord();
    if (currentMentor?.id) {
      await firstValueFrom(this.platformService.updateMentorAvailability(currentMentor.id, this.mentorForm.getRawValue().availability ?? ''));
      this.snackBar.open('Availability updated.', 'Close', { duration: 3000 });
    } else {
      await firstValueFrom(
        this.platformService.applyAsMentor({
          name: user.name,
          userId: user.id,
          rating: 0,
          bio: this.mentorForm.getRawValue().bio ?? '',
          skills: this.mentorForm.getRawValue().skills ?? '',
          experience: this.mentorForm.getRawValue().experience ?? '',
          hourlyRate: this.mentorForm.getRawValue().hourlyRate ?? 500,
          availability: this.mentorForm.getRawValue().availability ?? ''
        })
      );
      this.snackBar.open('Mentor application submitted.', 'Close', { duration: 3000 });
    }

    await this.loadProfile();
  }
}

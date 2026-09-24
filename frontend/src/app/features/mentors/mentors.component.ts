import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { Mentor, Review, Skill } from '../../core/models/platform.model';
import { PlatformService } from '../../core/services/platform.service';
import { avatarColor, initialsOf } from '../../shared/utils/avatar-color';
import { skillList } from '../../shared/utils/skills';

@Component({
  selector: 'app-mentors',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './mentors.component.html',
  styleUrls: ['./mentors.component.scss']
})
export class MentorsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly platformService = inject(PlatformService);
  private readonly router = inject(Router);

  readonly filterForm = this.fb.group({
    query: [''],
    skill: [''],
    minRating: [3],
    maxPrice: [null as number | null],
    availability: ['']
  });

  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly mentors = signal<Mentor[]>([]);
  readonly skills = signal<Skill[]>([]);
  readonly selectedMentor = signal<Mentor | null>(null);
  readonly selectedReviews = signal<Review[]>([]);
  readonly selectedAverage = signal<number>(0);
  readonly filtersOpen = signal(false);

  readonly activeFilters = signal<{ key: string; label: string }[]>([]);

  ngOnInit(): void {
    void this.loadPage();
  }

  async loadPage(): Promise<void> {
    this.loading.set(true);

    forkJoin({
      skills: this.platformService.getSkills(),
      mentors: this.platformService.getMentors()
    }).subscribe({
      next: ({ skills, mentors }) => {
        this.skills.set(skills);
        this.mentors.set(mentors);
        this.selectedMentor.set(mentors[0] ?? null);
        if (mentors[0]) {
          void this.viewMentor(mentors[0]);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  search(): void {
    const value = this.filterForm.getRawValue();
    const pills: { key: string; label: string }[] = [];
    if (value.skill) pills.push({ key: 'skill', label: value.skill });
    if (value.minRating) pills.push({ key: 'minRating', label: `★ ${value.minRating}+` });
    if (value.maxPrice) pills.push({ key: 'maxPrice', label: `< ₹${value.maxPrice}/hr` });
    if (value.availability) pills.push({ key: 'availability', label: value.availability });
    this.activeFilters.set(pills);
    this.filtersOpen.set(false);

    this.loading.set(true);
    this.platformService.getMentors({
      skill: value.skill || undefined,
      minRating: value.minRating ?? undefined,
      maxPrice: value.maxPrice ?? undefined,
      availability: value.availability || undefined
    }).subscribe({
      next: (mentors) => {
        const query = (value.query ?? '').trim().toLowerCase();
        const filtered = query
          ? mentors.filter((mentor) =>
              `${mentor.name} ${mentor.bio} ${mentor.skills} ${mentor.experience}`.toLowerCase().includes(query)
            )
          : mentors;

        this.mentors.set(filtered);
        this.selectedMentor.set(filtered[0] ?? null);
        if (filtered[0]) {
          void this.viewMentor(filtered[0]);
        } else {
          this.selectedReviews.set([]);
          this.selectedAverage.set(0);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  async viewMentor(mentor: Mentor): Promise<void> {
    this.selectedMentor.set(mentor);
    this.detailLoading.set(true);

    forkJoin({
      reviews: this.platformService.getMentorReviews(mentor.id),
      average: this.platformService.getMentorAverageRating(mentor.id)
    }).subscribe({
      next: ({ reviews, average }) => {
        this.selectedReviews.set(reviews);
        this.selectedAverage.set(average);
        this.detailLoading.set(false);
      },
      error: () => {
        this.selectedReviews.set([]);
        this.selectedAverage.set(mentor.rating);
        this.detailLoading.set(false);
      }
    });
  }

  bookMentor(mentorId: number): void {
    void this.router.navigate(['/sessions'], { queryParams: { mentor: mentorId } });
  }

  clearFilter(key: string): void {
    const resetValue = key === 'minRating' ? null : '';
    this.filterForm.patchValue({ [key]: resetValue } as never);
    this.search();
  }

  clearAllFilters(): void {
    this.filterForm.reset({ query: this.filterForm.value.query ?? '', skill: '', minRating: null, maxPrice: null, availability: '' });
    this.search();
  }

  initials(name: string): string {
    return initialsOf(name);
  }

  avatarBg(seed: string): string {
    return avatarColor(seed);
  }

  mentorSkills(mentor: Mentor): string[] {
    return skillList(mentor.skills);
  }
}

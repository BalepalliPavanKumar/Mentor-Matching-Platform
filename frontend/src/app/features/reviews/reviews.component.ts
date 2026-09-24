import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { Mentor, Review } from '../../core/models/platform.model';
import { PlatformService } from '../../core/services/platform.service';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatChipsModule,
    MatSnackBarModule
  ],
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly platformService = inject(PlatformService);
  readonly authStore = inject(AuthStore);

  readonly mentors = signal<Mentor[]>([]);
  readonly reviews = signal<Review[]>([]);
  readonly average = signal(0);

  readonly reviewForm = this.fb.group({
    mentorId: [null as number | null, Validators.required],
    rating: [5, Validators.required],
    comment: ['', Validators.required]
  });

  ngOnInit(): void {
    this.platformService.getMentors().subscribe((mentors) => {
      this.mentors.set(mentors);
      const preselected = Number(this.route.snapshot.queryParamMap.get('mentor'));
      if (preselected) {
        this.reviewForm.patchValue({ mentorId: preselected });
        void this.loadMentorReviews(preselected);
      }
    });
  }

  async loadMentorReviews(mentorId: number): Promise<void> {
    const [reviews, average] = await Promise.all([
      firstValueFrom(this.platformService.getMentorReviews(mentorId)),
      firstValueFrom(this.platformService.getMentorAverageRating(mentorId))
    ]);

    this.reviews.set(reviews);
    this.average.set(average);
  }

  async submitReview(): Promise<void> {
    const userId = this.authStore.user()?.id;
    const { mentorId, rating, comment } = this.reviewForm.getRawValue();
    if (!userId || !mentorId || !rating || !comment) {
      return;
    }

    await firstValueFrom(this.platformService.submitReview({ mentorId, userId, rating, comment }));
    this.snackBar.open('Review submitted.', 'Close', { duration: 3000 });
    this.reviewForm.patchValue({ rating: 5, comment: '' });
    await this.loadMentorReviews(mentorId);
  }
}

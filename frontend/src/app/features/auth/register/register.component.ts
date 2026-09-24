import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterRequest } from '../../../core/models/auth.model';
import { UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  isSubmitting = false;

  readonly registerForm = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['ROLE_LEARNER' as UserRole, [Validators.required]]
  });

  readonly roles: { value: UserRole; label: string }[] = [
    { value: 'ROLE_LEARNER', label: 'Learner' },
    { value: 'ROLE_MENTOR', label: 'Mentor' },
    { value: 'ROLE_ADMIN', label: 'Admin' }
  ];

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      return;
    }

    this.isSubmitting = true;

    try {
      await firstValueFrom(this.authService.register(this.registerForm.getRawValue() as RegisterRequest));
      this.snackBar.open('Registration completed. You can sign in now.', 'Close', { duration: 4000 });
      await this.router.navigate(['/auth/login']);
    } finally {
      this.isSubmitting = false;
    }
  }
}

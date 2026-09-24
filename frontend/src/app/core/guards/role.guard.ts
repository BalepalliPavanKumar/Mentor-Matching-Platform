import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../store/auth.store';
import { UserRole } from '../models/user.model';

export const roleGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const expectedRole = route.data['role'] as UserRole | undefined;

  if (!store.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  if (!expectedRole || store.user()?.role === expectedRole) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

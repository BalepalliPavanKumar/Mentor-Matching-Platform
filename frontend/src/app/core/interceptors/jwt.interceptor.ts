import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../store/auth.store';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const token = store.token();
  const isAuthRequest = req.url.includes('/auth/login') || req.url.includes('/auth/register') || req.url.includes('/auth/refresh');

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401 && !isAuthRequest) {
        store.logout();
        if (typeof window !== 'undefined') {
          window.location.replace(`${window.location.origin}/auth/login`);
        }
      }

      return throwError(() => error);
    })
  );
};

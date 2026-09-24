import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private api = inject(ApiService);

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.api.endpoint('/auth/login'), credentials);
  }

  register(userData: RegisterRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.api.endpoint('/auth/register'), userData);
  }
}

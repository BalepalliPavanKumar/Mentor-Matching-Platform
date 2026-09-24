import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  readonly baseUrl = 'http://localhost:8080';

  endpoint(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}

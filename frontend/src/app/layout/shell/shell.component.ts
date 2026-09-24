import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { AuthStore } from '../../core/store/auth.store';
import { avatarColor, initialsOf } from '../../shared/utils/avatar-color';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatMenuModule
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss']
})
export class ShellComponent {
  readonly authStore = inject(AuthStore);

  readonly menuItems = computed(() => {
    if (this.authStore.isAdmin()) {
      return [
        { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
        { label: 'Admin Console', icon: 'admin_panel_settings', route: '/admin' },
        { label: 'Learning Groups', icon: 'groups', route: '/groups' },
        { label: 'My Profile', icon: 'badge', route: '/profile' }
      ];
    }

    const common = [
      { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
      { label: 'Find Mentors', icon: 'person_search', route: '/mentors' },
      { label: 'Learning Groups', icon: 'groups', route: '/groups' },
      { label: 'My Profile', icon: 'badge', route: '/profile' }
    ];

    if (this.authStore.isMentor()) {
      return [
        ...common,
        { label: 'Session Requests', icon: 'event_available', route: '/sessions' },
        { label: 'Reviews', icon: 'reviews', route: '/reviews' }
      ];
    }

    return [
      ...common,
      { label: 'My Sessions', icon: 'calendar_month', route: '/sessions' },
      { label: 'Reviews', icon: 'reviews', route: '/reviews' }
    ];
  });

  readonly initials = computed(() => initialsOf(this.authStore.user()?.name ?? 'SkillSync User'));

  readonly avatarBg = computed(() =>
    avatarColor(this.authStore.user()?.email ?? this.authStore.user()?.name ?? 'user')
  );

  logout(): void {
    this.authStore.logout();
    if (typeof window !== 'undefined') {
      window.location.replace(`${window.location.origin}/auth/login`);
    }
  }
}

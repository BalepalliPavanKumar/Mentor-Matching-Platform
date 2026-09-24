import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { GroupMember, GroupMessage, GroupRecord } from '../../core/models/platform.model';
import { PlatformService } from '../../core/services/platform.service';
import { avatarColor } from '../../shared/utils/avatar-color';

type GroupTab = 'all' | 'mine' | 'trending' | 'recommended';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule
  ],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss']
})
export class GroupsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly platformService = inject(PlatformService);
  readonly authStore = inject(AuthStore);

  readonly createGroupForm = this.fb.group({
    name: ['', Validators.required],
    description: ['', Validators.required]
  });
  readonly messageForm = this.fb.group({
    content: ['', Validators.required]
  });

  readonly groups = signal<GroupRecord[]>([]);
  readonly membersByGroup = signal<Record<number, GroupMember[]>>({});
  readonly messages = signal<GroupMessage[]>([]);
  readonly selectedGroup = signal<GroupRecord | null>(null);
  readonly activeTab = signal<GroupTab>('all');
  readonly searchQuery = signal('');

  readonly filteredGroups = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    let list = this.groups().slice();

    if (query) {
      list = list.filter((group) =>
        `${group.name} ${group.description}`.toLowerCase().includes(query)
      );
    }

    switch (this.activeTab()) {
      case 'mine':
        return list.filter((group) => this.isMember(group.id ?? 0));
      case 'trending':
        return list.sort((a, b) => this.membersFor(b.id).length - this.membersFor(a.id).length);
      case 'recommended':
        return list
          .filter((group) => !this.isMember(group.id ?? 0))
          .sort((a, b) => this.membersFor(b.id).length - this.membersFor(a.id).length);
      default:
        return list;
    }
  });

  readonly memberCount = computed(() => {
    const group = this.selectedGroup();
    if (!group?.id) {
      return 0;
    }
    return this.membersByGroup()[group.id]?.length ?? 0;
  });

  ngOnInit(): void {
    void this.loadGroups();
  }

  async loadGroups(): Promise<void> {
    this.platformService.getGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        if (!groups.length) {
          return;
        }

        forkJoin(groups.map((group) => this.platformService.getGroupMembers(group.id!))).subscribe({
          next: (memberArrays) => {
            const mapped = memberArrays.reduce<Record<number, GroupMember[]>>((acc, members, index) => {
              const groupId = groups[index].id!;
              acc[groupId] = members;
              return acc;
            }, {});
            this.membersByGroup.set(mapped);
          }
        });

        void this.selectGroup(groups[0]);
      }
    });
  }

  isMember(groupId: number): boolean {
    const userId = this.authStore.user()?.id;
    return (this.membersByGroup()[groupId] ?? []).some((member) => member.userId === userId);
  }

  membersFor(groupId: number | undefined): GroupMember[] {
    if (!groupId) {
      return [];
    }

    return this.membersByGroup()[groupId] ?? [];
  }

  async selectGroup(group: GroupRecord): Promise<void> {
    this.selectedGroup.set(group);
    if (!group.id) {
      return;
    }

    const [members, messages] = await Promise.all([
      firstValueFrom(this.platformService.getGroupMembers(group.id)),
      firstValueFrom(this.platformService.getGroupMessages(group.id))
    ]);

    this.membersByGroup.set({ ...this.membersByGroup(), [group.id]: members });
    this.messages.set(messages);
  }

  async toggleMembership(group: GroupRecord): Promise<void> {
    const groupId = group.id;
    const userId = this.authStore.user()?.id;
    if (!groupId || !userId) {
      return;
    }

    if (this.isMember(groupId)) {
      await firstValueFrom(this.platformService.leaveGroup(groupId, userId));
      this.snackBar.open('Left group.', 'Close', { duration: 3000 });
    } else {
      await firstValueFrom(this.platformService.joinGroup(groupId, userId));
      this.snackBar.open('Joined group.', 'Close', { duration: 3000 });
    }

    await this.loadGroups();
    if (this.selectedGroup()?.id === groupId) {
      const current = this.groups().find((item) => item.id === groupId);
      if (current) {
        await this.selectGroup(current);
      }
    }
  }

  async createGroup(): Promise<void> {
    const userId = this.authStore.user()?.id;
    if (this.createGroupForm.invalid || !userId) {
      return;
    }

    await firstValueFrom(
      this.platformService.createGroup({
        ...this.createGroupForm.getRawValue(),
        createdBy: userId
      } as GroupRecord)
    );

    this.createGroupForm.reset();
    this.snackBar.open('Group created.', 'Close', { duration: 3000 });
    await this.loadGroups();
  }

  async sendMessage(): Promise<void> {
    const groupId = this.selectedGroup()?.id;
    const userId = this.authStore.user()?.id;
    const content = this.messageForm.getRawValue().content;
    if (!groupId || !userId || !content) {
      return;
    }

    await firstValueFrom(this.platformService.postGroupMessage(groupId, { userId, content }));
    this.messageForm.reset();
    const current = this.selectedGroup();
    if (current) {
      await this.selectGroup(current);
    }
  }

  groupColor(name: string): string {
    return avatarColor(name);
  }
}

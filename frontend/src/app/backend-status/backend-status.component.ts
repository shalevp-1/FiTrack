import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, of, timer } from 'rxjs';
import { catchError, map, switchMap, timeout } from 'rxjs/operators';

interface HealthResponse {
  status: string;
}

@Component({
  selector: 'app-backend-status',
  templateUrl: './backend-status.component.html',
  styleUrls: ['./backend-status.component.css']
})
export class BackendStatusComponent implements OnInit, OnDestroy {
  serverStarting = false;
  showRecoveredNotice = false;
  readonly confettiPieces = Array.from({ length: 24 }, (_, index) => ({
    id: index,
    left: (index * 41 + 7) % 100,
    delay: (index % 8) * 0.08
  }));

  private wasOffline = false;
  private healthSubscription?: Subscription;
  private recoveredNoticeTimer?: ReturnType<typeof setTimeout>;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.healthSubscription = timer(0, 5000).pipe(
      switchMap(() =>
        this.http.get<HealthResponse>('/api/health').pipe(
          timeout(3500),
          map(() => true),
          catchError(() => of(false))
        )
      )
    ).subscribe(isReady => this.updateStatus(isReady));
  }

  ngOnDestroy(): void {
    this.healthSubscription?.unsubscribe();
    if (this.recoveredNoticeTimer) {
      clearTimeout(this.recoveredNoticeTimer);
    }
  }

  private updateStatus(isReady: boolean): void {
    if (!isReady) {
      this.serverStarting = true;
      this.wasOffline = true;
      this.showRecoveredNotice = false;
      if (this.recoveredNoticeTimer) {
        clearTimeout(this.recoveredNoticeTimer);
        this.recoveredNoticeTimer = undefined;
      }
      return;
    }

    this.serverStarting = false;
    if (!this.wasOffline) {
      return;
    }

    this.wasOffline = false;
    this.showRecoveredNotice = true;
    if (this.recoveredNoticeTimer) {
      clearTimeout(this.recoveredNoticeTimer);
    }

    this.recoveredNoticeTimer = setTimeout(() => {
      this.showRecoveredNotice = false;
      this.recoveredNoticeTimer = undefined;
    }, 4000);
  }
}

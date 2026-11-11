import { Component, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subscription, TimeoutError, of, timer } from 'rxjs';
import {
  catchError,
  filter,
  finalize,
  map,
  switchMap,
  take,
  tap,
  timeout
} from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { CartService } from '../services/cart.service';

interface HealthResponse {
  status: string;
}

interface LoginResponse {
  loggedIn: boolean;
  user?: {
    id?: number;
  };
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnDestroy {
  loginValue = '';
  password = '';
  private returnUrl = '/dashboard';

  errorMessage = '';
  successMessage = '';
  isLoggingIn = false;
  isWaitingForServer = false;

  private readonly healthCheckIntervalMs = 5000;
  private readonly healthCheckTimeoutMs = 3500;
  private readonly maxServerWaitMs = 120000;
  private loginSubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private cartService: CartService,
    route: ActivatedRoute
  ) {
    const requestedUrl = route.snapshot.queryParamMap.get('returnUrl');
    if (requestedUrl?.startsWith('/') && !requestedUrl.startsWith('//')) {
      this.returnUrl = requestedUrl;
    }
    if (route.snapshot.queryParamMap.get('authCheck') === 'failed') {
      this.errorMessage =
        'We could not verify your session. Please sign in again.';
    }
  }

  ngOnDestroy(): void {
    this.loginSubscription?.unsubscribe();
  }

  login(): void {
    if (this.isLoggingIn) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.isLoggingIn = true;
    this.isWaitingForServer = true;

    this.loginSubscription = timer(0, this.healthCheckIntervalMs).pipe(
      switchMap(() =>
        this.http.get<HealthResponse>('/api/health').pipe(
          timeout(this.healthCheckTimeoutMs),
          map(response => response.status === 'ok'),
          catchError(() => of(false))
        )
      ),
      filter(isReady => isReady),
      take(1),
      timeout(this.maxServerWaitMs),
      tap(() => {
        this.isWaitingForServer = false;
      }),
      switchMap(() =>
        this.http.post(
          '/api/login',
          {
            login: this.loginValue,
            password: this.password
          },
          { withCredentials: true }
        ).pipe(
          catchError(error => {
            this.errorMessage =
              error?.error?.message ||
              (error?.status === 0 || [502, 503, 504].includes(error?.status)
                ? 'The server is temporarily unavailable. Please try again.'
                : error?.status === 401
                  ? 'Invalid username/email or password.'
                  : 'Login failed. Please try again.');
            return EMPTY;
          })
        )
      ),
      switchMap(() =>
        this.http.get<LoginResponse>(
          '/api/me',
          { withCredentials: true }
        ).pipe(
          catchError(() => {
            this.errorMessage =
              'Login succeeded, but your account could not be loaded.';
            return EMPTY;
          })
        )
      ),
      finalize(() => {
        this.isLoggingIn = false;
        this.isWaitingForServer = false;
      })
    ).subscribe({
      next: response => {
        if (response.loggedIn && response.user?.id) {
          this.cartService.setUser(response.user.id);
          this.authService.setLoggedIn();
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.errorMessage = 'Could not load your account.';
        }
      },
      error: error => {
        if (error instanceof TimeoutError) {
          this.errorMessage =
            'Our server is still unavailable. Please try again in a little while.';
          return;
        }

        this.errorMessage =
          'Could not check server availability. Please try again.';
      }
    });
  }
}

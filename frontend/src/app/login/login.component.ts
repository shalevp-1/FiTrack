import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginValue = '';
  password = '';
  private returnUrl = '/dashboard';

  errorMessage = '';
  successMessage = '';

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

  login(): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.http.post<any>(
      '/api/login',
      {
        login: this.loginValue,
        password: this.password
      },
      { withCredentials: true }
    ).subscribe({
      next: () => {
        // Login succeeded. Now retrieve the authenticated user's ID.
        this.http.get<any>(
          '/api/me',
          { withCredentials: true }
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
          error: () => {
            this.errorMessage =
              'Login succeeded, but your account could not be loaded.';
          }
        });
      },
      error: error => {
        this.errorMessage =
          error?.error?.message || 'Invalid username/email or password.';
      }
    });
  }
}

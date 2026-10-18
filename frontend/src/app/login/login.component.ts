import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
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

  errorMessage = '';
  successMessage = '';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private cartService: CartService
  ) {}

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
              this.router.navigate(['/dashboard']);
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
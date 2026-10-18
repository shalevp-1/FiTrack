import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Promise<boolean> {
    return new Promise((resolve) => {

      this.authService.checkLogin().subscribe((loggedIn) => {

        if (loggedIn) {
          resolve(true);
        } else {
          alert('Access denied. Please log in first.');
          this.router.navigate(['/login']);
          resolve(false);
        }

      });

    });
  }
}
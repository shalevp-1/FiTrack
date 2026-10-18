
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Promise<boolean> {
    return new Promise((resolve) => {
      this.authService.checkAdmin().subscribe({
        next: (isAdmin) => {
          if (isAdmin) {
            resolve(true);
          } else {
            alert('Admin access required.');
            this.router.navigate(['/home']);
            resolve(false);
          }
        },
        error: () => {
          this.router.navigate(['/login']);
          resolve(false);
        }
      });
    });
  }
}

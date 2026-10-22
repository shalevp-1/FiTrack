import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.checkLogin().pipe(
      map(loggedIn => {
        if (loggedIn) {
          return true;
        }

        return this.router.createUrlTree(['/login'], {
          queryParams: { returnUrl: this.router.url }
        });
      }),
      catchError(error => {
        console.error('Could not verify authentication for protected route:', error);
        return of(this.router.createUrlTree(['/login'], {
          queryParams: { authCheck: 'failed', returnUrl: this.router.url }
        }));
      })
    );
  }
}

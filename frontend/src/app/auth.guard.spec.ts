import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let router: Router;
  let checkLogin: jasmine.Spy;

  beforeEach(() => {
    checkLogin = jasmine.createSpy('checkLogin').and.returnValue(of(true));
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: { checkLogin } }
      ]
    });
    guard = TestBed.inject(AuthGuard);
    router = TestBed.inject(Router);
  });

  it('allows access when the user is authenticated', done => {
    guard.canActivate().subscribe(result => {
      expect(result).toBeTrue();
      done();
    });
  });

  it('redirects unauthenticated users to login', done => {
    spyOn(window, 'alert').and.stub();
    checkLogin.and.returnValue(of(false));

    guard.canActivate().subscribe(result => {
      expect(result instanceof UrlTree).toBeTrue();
      expect(router.serializeUrl(result as UrlTree)).toBe('/login');
      expect(window.alert).toHaveBeenCalledWith(
        'Access denied. Please log in first.'
      );
      done();
    });
  });

  it('redirects to login with an explicit error when the session check fails', done => {
    spyOn(console, 'error');
    checkLogin.and.returnValue(throwError(() => new Error('network failure')));

    guard.canActivate().subscribe(result => {
      expect(result instanceof UrlTree).toBeTrue();
      expect(router.serializeUrl(result as UrlTree))
        .toBe('/login?authCheck=failed');
      expect(console.error).toHaveBeenCalled();
      done();
    });
  });
});

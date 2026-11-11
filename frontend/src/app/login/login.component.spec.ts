import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let httpTestingController: HttpTestingController;
  let queryParamMap = convertToParamMap({ authCheck: null });

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [
        FormsModule,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { queryParamMap };
            }
          }
        }
      ]
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a session verification error when redirected by the auth guard', () => {
    fixture.destroy();
    queryParamMap = convertToParamMap({ authCheck: 'failed' });
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;

    expect(component.errorMessage)
      .toBe('We could not verify your session. Please sign in again.');
  });

  it('checks readiness before logging in and completes the existing login flow', fakeAsync(() => {
    component.loginValue = 'user';
    component.password = 'password';

    component.login();
    tick(0);

    const healthRequest = httpTestingController.expectOne('/api/health');
    expect(healthRequest.request.method).toBe('GET');
    expect(httpTestingController.match('/api/login').length).toBe(0);

    healthRequest.flush({ status: 'ok' });

    const loginRequest = httpTestingController.expectOne('/api/login');
    expect(loginRequest.request.method).toBe('POST');
    expect(loginRequest.request.body).toEqual({
      login: 'user',
      password: 'password'
    });
    loginRequest.flush({ message: 'Logged in successfully' });

    const accountRequest = httpTestingController.expectOne('/api/me');
    accountRequest.flush({
      loggedIn: true,
      user: { id: 1 }
    });

    expect(component.isLoggingIn).toBeFalse();
    expect(component.errorMessage).toBe('');
  }));

  it('waits and polls again after the health endpoint reports the server is starting', fakeAsync(() => {
    component.loginValue = 'user';
    component.password = 'password';

    component.login();
    tick(0);

    const startingRequest = httpTestingController.expectOne('/api/health');
    startingRequest.flush(
      { status: 'starting' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(component.isWaitingForServer).toBeTrue();
    expect(httpTestingController.match('/api/login').length).toBe(0);

    tick(5000);
    const readyRequest = httpTestingController.expectOne('/api/health');
    readyRequest.flush({ status: 'ok' });

    const loginRequest = httpTestingController.expectOne('/api/login');
    loginRequest.flush({ message: 'Logged in successfully' });
    httpTestingController.expectOne('/api/me').flush({
      loggedIn: true,
      user: { id: 1 }
    });

    expect(component.isLoggingIn).toBeFalse();
    expect(component.isWaitingForServer).toBeFalse();
  }));

  it('continues polling after the health endpoint is unreachable', fakeAsync(() => {
    component.login();
    tick(0);

    httpTestingController.expectOne('/api/health').flush(
      null,
      { status: 0, statusText: 'Unknown Error' }
    );
    expect(httpTestingController.match('/api/login').length).toBe(0);

    tick(5000);
    httpTestingController.expectOne('/api/health').flush({ status: 'ok' });
    httpTestingController.expectOne('/api/login').flush(
      { message: 'Invalid username/email or password.' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(component.errorMessage).toBe('Invalid username/email or password.');
    expect(component.isLoggingIn).toBeFalse();
  }));

  it('does not start duplicate login attempts while waiting for readiness', fakeAsync(() => {
    component.login();
    component.login();
    tick(0);

    const healthRequests = httpTestingController.match('/api/health');
    expect(healthRequests.length).toBe(1);

    healthRequests[0].flush({ status: 'ok' });
    httpTestingController.expectOne('/api/login').flush({});
    httpTestingController.expectOne('/api/me').flush({ loggedIn: false });
  }));

  it('cancels the health polling when the login page is destroyed', fakeAsync(() => {
    component.login();
    tick(0);

    const healthRequest = httpTestingController.expectOne('/api/health');
    fixture.destroy();

    expect(healthRequest.cancelled).toBeTrue();
  }));

  it('stops polling and shows an error when the server does not become ready in time', fakeAsync(() => {
    component.login();
    tick(0);

    for (let attempt = 0; attempt < 24; attempt++) {
      const healthRequest = httpTestingController.expectOne('/api/health');
      healthRequest.flush(
        { status: 'starting' },
        { status: 503, statusText: 'Service Unavailable' }
      );
      tick(5000);
    }

    expect(component.isLoggingIn).toBeFalse();
    expect(component.isWaitingForServer).toBeFalse();
    expect(component.errorMessage)
      .toBe('Our server is still unavailable. Please try again in a little while.');
    expect(httpTestingController.match('/api/login').length).toBe(0);
  }));

  it('keeps invalid credentials separate from server availability errors', fakeAsync(() => {
    component.login();
    tick(0);

    httpTestingController.expectOne('/api/health').flush({ status: 'ok' });
    httpTestingController.expectOne('/api/login').flush(
      { message: 'Invalid username/email or password.' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(component.errorMessage).toBe('Invalid username/email or password.');
    expect(component.isLoggingIn).toBeFalse();
    expect(httpTestingController.match('/api/health').length).toBe(0);
  }));
});
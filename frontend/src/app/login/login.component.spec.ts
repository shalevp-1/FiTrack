import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
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

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
});
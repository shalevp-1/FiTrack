import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Subject } from 'rxjs';

import { HomeComponent } from './home.component';
import { AuthService } from '../auth.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let loginStatus: Subject<boolean>;

  beforeEach(() => {
    loginStatus = new Subject<boolean>();
    TestBed.configureTestingModule({
      declarations: [HomeComponent],
      imports: [CommonModule, RouterTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: {
            checkLogin: () => of(false),
            loginStatus$: loginStatus
          }
        }
      ]
    });
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('unsubscribes from login status when destroyed', () => {
    expect(loginStatus.observers.length).toBe(1);

    fixture.destroy();

    expect(loginStatus.observers.length).toBe(0);
  });
});

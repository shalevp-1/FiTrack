import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';

import { RouterMainComponent } from './router-main.component';
import { AuthService } from '../auth.service';
import { CartService } from '../services/cart.service';

describe('RouterMainComponent', () => {
  let component: RouterMainComponent;
  let fixture: ComponentFixture<RouterMainComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RouterMainComponent],
      imports: [CommonModule, HttpClientTestingModule, RouterTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: {
            checkLogin: () => of(false),
            loginStatus$: new Subject<boolean>()
          }
        },
        {
          provide: CartService,
          useValue: {
            items$: new BehaviorSubject([]),
            getItemCount: () => 0
          }
        }
      ]
    });
    fixture = TestBed.createComponent(RouterMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

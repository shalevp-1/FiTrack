import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { MyOrdersComponent } from './my-orders.component';
import { OrdersService } from '../services/orders.service';

describe('MyOrdersComponent', () => {
  let component: MyOrdersComponent;
  let fixture: ComponentFixture<MyOrdersComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MyOrdersComponent],
      imports: [CommonModule, RouterTestingModule],
      providers: [
        { provide: OrdersService, useValue: { getMyOrders: () => of([]) } }
      ]
    });
    fixture = TestBed.createComponent(MyOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

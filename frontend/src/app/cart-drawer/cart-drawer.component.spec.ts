import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { CartService } from '../services/cart.service';

import { CartDrawerComponent } from './cart-drawer.component';

describe('CartDrawerComponent', () => {
  let component: CartDrawerComponent;
  let fixture: ComponentFixture<CartDrawerComponent>;
  let router: jasmine.SpyObj<Router>;
  let cartService: jasmine.SpyObj<CartService>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    Object.defineProperty(router, 'events', { value: EMPTY });
    cartService = jasmine.createSpyObj<CartService>(
      'CartService',
      ['closeDrawer', 'updateQuantity', 'removeProduct', 'getItemCount', 'getSubtotal'],
      {
        items$: new BehaviorSubject([]),
        drawerOpen$: new BehaviorSubject(false)
      }
    );
    cartService.getItemCount.and.returnValue(0);
    cartService.getSubtotal.and.returnValue(0);

    TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [CartDrawerComponent],
      providers: [
        { provide: CartService, useValue: cartService },
        { provide: Router, useValue: router }
      ]
    });
    fixture = TestBed.createComponent(CartDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('closes the drawer and navigates to checkout', () => {
    component.goToCheckout();

    expect(cartService.closeDrawer).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/checkout']);
  });
});

import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
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
  let drawerOpenSubject: BehaviorSubject<boolean>;
  let openerElement: HTMLButtonElement | null;

  beforeEach(() => {
    openerElement = null;
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    Object.defineProperty(router, 'events', { value: EMPTY });
    drawerOpenSubject = new BehaviorSubject(false);
    cartService = jasmine.createSpyObj<CartService>(
      'CartService',
      ['closeDrawer', 'updateQuantity', 'removeProduct', 'getItemCount', 'getSubtotal'],
      {
        items$: new BehaviorSubject([]),
        drawerOpen$: drawerOpenSubject
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

  afterEach(() => {
    openerElement?.remove();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('closes the drawer and navigates to checkout', () => {
    component.goToCheckout();

    expect(cartService.closeDrawer).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/checkout']);
  });

  it('exposes the dialog and moves focus into it when opened', fakeAsync(() => {
    openerElement = document.createElement('button');
    document.body.appendChild(openerElement);
    openerElement.focus();

    drawerOpenSubject.next(true);
    fixture.detectChanges();
    tick();

    const drawer = fixture.nativeElement.querySelector('aside') as HTMLElement;
    const closeButton = fixture.nativeElement.querySelector('.cart-drawer-close') as HTMLButtonElement;

    expect(drawer.getAttribute('aria-hidden')).toBe('false');
    expect(drawer.getAttribute('aria-modal')).toBe('true');
    expect(drawer.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(closeButton);
  }));

  it('makes the closed drawer inert and restores focus to its opener', fakeAsync(() => {
    openerElement = document.createElement('button');
    document.body.appendChild(openerElement);
    openerElement.focus();

    drawerOpenSubject.next(true);
    fixture.detectChanges();
    tick();

    drawerOpenSubject.next(false);
    fixture.detectChanges();

    const drawer = fixture.nativeElement.querySelector('aside') as HTMLElement;
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    expect(drawer.hasAttribute('aria-modal')).toBe(false);
    expect(drawer.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(openerElement);
  }));

  it('closes the open drawer when Escape is pressed', fakeAsync(() => {
    drawerOpenSubject.next(true);
    fixture.detectChanges();
    tick();

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    document.dispatchEvent(escapeEvent);

    expect(cartService.closeDrawer).toHaveBeenCalled();
    expect(escapeEvent.defaultPrevented).toBe(true);
  }));
});

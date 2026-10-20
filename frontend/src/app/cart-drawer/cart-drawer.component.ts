
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../services/cart.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-cart-drawer',
  templateUrl: './cart-drawer.component.html',
  styleUrls: ['./cart-drawer.component.css']
})
export class CartDrawerComponent implements OnInit, OnDestroy {
  @ViewChild('drawer') private drawerRef!: ElementRef<HTMLElement>;
  @ViewChild('closeButton') private closeButtonRef!: ElementRef<HTMLButtonElement>;

  cartItems: CartItem[] = [];
  cartDrawerOpen = false;
  cartMessage = '';
  cartMessageType: 'success' | 'error' = 'success';

  private openerElement: HTMLElement | null = null;
  private focusTimeout?: ReturnType<typeof setTimeout>;
  private itemsSubscription?: Subscription;
  private drawerSubscription?: Subscription;
  private navigationSubscription?: Subscription;

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.itemsSubscription = this.cartService.items$.subscribe(items => {
      this.cartItems = items;
    });

    this.drawerSubscription = this.cartService.drawerOpen$.subscribe(isOpen => {
      if (isOpen && !this.cartDrawerOpen) {
        this.rememberOpener();
      } else if (!isOpen && this.cartDrawerOpen) {
        this.restoreFocus();
      }

      this.cartDrawerOpen = isOpen;

      if (isOpen) {
        this.focusTimeout = setTimeout(() => {
          if (this.cartDrawerOpen) {
            this.closeButtonRef.nativeElement.focus();
          }
        });
      }
    });

    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.closeCart());
  }

  ngOnDestroy(): void {
    if (this.focusTimeout !== undefined) {
      clearTimeout(this.focusTimeout);
    }

    this.itemsSubscription?.unsubscribe();
    this.drawerSubscription?.unsubscribe();
    this.navigationSubscription?.unsubscribe();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.cartDrawerOpen) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeCart();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = this.getFocusableElements();
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && (activeElement === firstElement || !this.drawerRef.nativeElement.contains(activeElement))) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && (activeElement === lastElement || !this.drawerRef.nativeElement.contains(activeElement))) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  closeCart(): void {
    this.cartService.closeDrawer();
  }

  changeQuantity(item: CartItem, quantity: number): void {
    const result = this.cartService.updateQuantity(item.product.id, quantity);
    this.cartMessage = result.message;
    this.cartMessageType = result.success ? 'success' : 'error';
  }

  removeItem(item: CartItem): void {
    this.cartService.removeProduct(item.product.id);
    this.cartMessage = `${item.product.name} removed from your cart.`;
    this.cartMessageType = 'success';
  }

  goToCheckout(): void {
    this.closeCart();
    this.router.navigate(['/checkout']);
  }

  get itemCount(): number {
    return this.cartService.getItemCount();
  }

  get subtotal(): number {
    return this.cartService.getSubtotal();
  }

  private rememberOpener(): void {
    const activeElement = document.activeElement;
    this.openerElement = activeElement instanceof HTMLElement
      ? activeElement
      : null;
  }

  private restoreFocus(): void {
    if (this.focusTimeout !== undefined) {
      clearTimeout(this.focusTimeout);
      this.focusTimeout = undefined;
    }

    const opener = this.openerElement;
    this.openerElement = null;

    if (opener?.isConnected && !opener.hasAttribute('disabled')) {
      opener.focus();
      if (document.activeElement === opener) {
        return;
      }
    }

    const fallback = Array.from(
      document.querySelectorAll<HTMLElement>(
        'main button:not([disabled]), main a[href], main [tabindex]:not([tabindex="-1"])'
      )
    ).find(element =>
      !this.drawerRef.nativeElement.contains(element) &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden'
    );

    fallback?.focus();
  }

  private getFocusableElements(): HTMLElement[] {
    return Array.from(
      this.drawerRef.nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(element =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden'
    );
  }
}

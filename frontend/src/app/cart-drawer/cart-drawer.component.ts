
import { Component, OnDestroy, OnInit } from '@angular/core';
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
  cartItems: CartItem[] = [];
  cartDrawerOpen = false;
  cartMessage = '';
  cartMessageType: 'success' | 'error' = 'success';

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
      this.cartDrawerOpen = isOpen;
    });

    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.closeCart());
  }

  ngOnDestroy(): void {
    this.itemsSubscription?.unsubscribe();
    this.drawerSubscription?.unsubscribe();
    this.navigationSubscription?.unsubscribe();
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
}

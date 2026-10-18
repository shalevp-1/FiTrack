
import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../services/cart.service';

interface OrderResponse {
  message: string;
  orderId: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentStatus: string;
}

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];

  message = '';
  messageType: 'success' | 'error' = 'error';
  submitting = false;

  orderPlaced = false;
  orderId: number | null = null;
  orderTotal = 0;

  private cartSubscription?: Subscription;

  constructor(
    private cartService: CartService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartSubscription = this.cartService.items$.subscribe(items => {
      this.items = items;

      if (items.length === 0 && !this.orderPlaced) {
        this.router.navigate(['/cart']);
      }
    });
  }

  ngOnDestroy(): void {
    this.cartSubscription?.unsubscribe();
  }

  get subtotal(): number {
    return this.cartService.getSubtotal();
  }

  placeOrder(): void {
    if (this.items.length === 0 || this.submitting || this.orderPlaced) {
      return;
    }

    this.submitting = true;
    this.message = '';

    const orderItems = this.items.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity
    }));

    this.http.post<OrderResponse>(
      '/api/orders',
      { items: orderItems },
      { withCredentials: true }
    ).subscribe({
      next: response => {
        this.orderId = response.orderId;
        this.orderTotal = Number(response.total);
        this.orderPlaced = true;
        this.submitting = false;

        // Empty the cart only after the server confirms order creation.
        this.cartService.clearCart();
      },
      error: error => {
        this.submitting = false;
        this.message =
          error?.error?.message ||
          'Could not place your order. Please try again.';

        this.messageType = 'error';
      }
    });
  }
}

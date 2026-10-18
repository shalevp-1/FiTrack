
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../services/cart.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent implements OnInit, OnDestroy {
  items: CartItem[] = [];
  message = '';
  messageType: 'success' | 'error' = 'success';

  private cartSubscription?: Subscription;

  constructor(private cartService: CartService) { }


  ngOnInit(): void {
    this.cartSubscription = this.cartService.items$.subscribe(items => {
      this.items = items;
    });
  }

  ngOnDestroy(): void {
    this.cartSubscription?.unsubscribe();
  }

  changeQuantity(item: CartItem, quantity: number): void {
    const result = this.cartService.updateQuantity(
      item.product.id,
      quantity
    );

    this.showMessage(result.message, result.success ? 'success' : 'error');
  }

  removeItem(item: CartItem): void {
    this.cartService.removeProduct(item.product.id);
    this.showMessage(`${item.product.name} removed from your cart.`, 'success');
  }

  get subtotal(): number {
    return this.cartService.getSubtotal();
  }
  
  get itemCount(): number {
    return this.cartService.getItemCount();
  }

  private showMessage(
    message: string,
    type: 'success' | 'error'
  ): void {
    this.message = message;
    this.messageType = type;
  }
}

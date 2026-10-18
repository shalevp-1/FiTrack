
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product } from './product.service';

export interface CartItem {
  product: Product;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly storagePrefix = 'fitrack_cart_';
  private readonly guestStorageKey = 'fitrack_cart_guest';

  private currentUserId: number | null = null;

  private itemsSubject = new BehaviorSubject<CartItem[]>(
    this.loadCart(this.guestStorageKey)
  );

  items$ = this.itemsSubject.asObservable();

  private drawerSubject = new BehaviorSubject<boolean>(false);
  drawerOpen$ = this.drawerSubject.asObservable();

  openDrawer(): void {
    this.drawerSubject.next(true);
  }

  closeDrawer(): void {
    this.drawerSubject.next(false);
  }

  private getStorageKey(): string {
    return this.currentUserId === null
      ? this.guestStorageKey
      : `${this.storagePrefix}${this.currentUserId}`;
  }

  private loadCart(key: string): CartItem[] {
    try {
      const savedCart = localStorage.getItem(key);

      if (!savedCart) {
        return [];
      }

      const parsed: unknown = JSON.parse(savedCart);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((item: any) =>
        item &&
        item.product &&
        Number.isInteger(item.product.id) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
      );
    } catch {
      return [];
    }
  }

  private saveCart(items: CartItem[]): void {
    localStorage.setItem(this.getStorageKey(), JSON.stringify(items));
    this.itemsSubject.next(items);
  }

  /**
   * Call after authentication has been verified.
   * Each account gets its own local cart.
   */
  setUser(userId: number | null): void {
    if (
      userId !== null &&
      (!Number.isInteger(userId) || userId <= 0)
    ) {
      return;
    }

    if (this.currentUserId === userId) {
      return;
    }

    this.currentUserId = userId;
    this.itemsSubject.next(this.loadCart(this.getStorageKey()));
  }

  getItems(): CartItem[] {
    return this.itemsSubject.value;
  }

  addProduct(
    product: Product,
    quantity: number = 1
  ): { success: boolean; message: string } {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { success: false, message: 'Invalid quantity.' };
    }

    if (product.stock_quantity <= 0) {
      return { success: false, message: 'This product is out of stock.' };
    }

    const items = this.getItems().map(item => ({ ...item }));
    const existingItem = items.find(
      item => item.product.id === product.id
    );

    const currentQuantity = existingItem ? existingItem.quantity : 0;

    if (currentQuantity + quantity > product.stock_quantity) {
      return {
        success: false,
        message: `Only ${product.stock_quantity} available in stock.`
      };
    }

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.product = product;
    } else {
      items.push({ product, quantity });
    }

    this.saveCart(items);

    return {
      success: true,
      message: `${product.name} added to your cart.`
    };
  }

  updateQuantity(
    productId: number,
    quantity: number
  ): { success: boolean; message: string } {
    const items = this.getItems().map(item => ({ ...item }));
    const item = items.find(
      cartItem => cartItem.product.id === productId
    );

    if (!item) {
      return {
        success: false,
        message: 'Product not found in your cart.'
      };
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return {
        success: false,
        message: 'Quantity must be at least 1.'
      };
    }

    if (quantity > item.product.stock_quantity) {
      return {
        success: false,
        message: `Only ${item.product.stock_quantity} available in stock.`
      };
    }

    item.quantity = quantity;
    this.saveCart(items);

    return { success: true, message: 'Cart updated.' };
  }

  removeProduct(productId: number): void {
    const items = this.getItems().filter(
      item => item.product.id !== productId
    );

    this.saveCart(items);
  }

  clearCart(): void {
    this.saveCart([]);
  }

  getItemCount(): number {
    return this.getItems().reduce(
      (total, item) => total + item.quantity,
      0
    );
  }

  getSubtotal(): number {
    return this.getItems().reduce(
      (total, item) =>
        total + Number(item.product.price) * item.quantity,
      0
    );
  }
}

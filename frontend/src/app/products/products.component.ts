
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Product, ProductService } from '../services/product.service';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];

  loading = false;
  errorMessage = '';
  cartMessage = '';
  cartMessageType: 'success' | 'error' = 'success';

  constructor(
    private router: Router,
    private productService: ProductService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.errorMessage = '';

    this.productService.getProducts().subscribe({
      next: products => {
        this.products = products;
        this.loading = false;
      },
      error: error => {
        console.error('Failed to load products:', error);
        this.errorMessage = 'Could not load products. Please try again.';
        this.loading = false;
      }
    });
  }

  userClickedAProduct(productId: number): void {
    this.router.navigate(['/products', productId]);
  }

  openCart(): void {
    this.cartService.openDrawer();
  }

  addToCart(product: Product, event?: Event): void {
    event?.stopPropagation();

    const result = this.cartService.addProduct(product);

    this.cartMessage = result.message;
    this.cartMessageType = result.success ? 'success' : 'error';

    if (result.success) {
      this.cartService.openDrawer();
    }
  }

  get itemCount(): number {
    return this.cartService.getItemCount();
  }

}

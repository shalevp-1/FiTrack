
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Product, ProductService } from '../services/product.service';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-product-detail-view',
  templateUrl: './product-detail-view.component.html',
  styleUrls: ['./product-detail-view.component.css']
})
export class ProductDetailViewComponent implements OnInit {
  productId?: number;
  product: Product | null = null;
  loading = false;
  errorMessage = '';

  cartMessage = '';
  cartMessageType: 'success' | 'error' = 'success';

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params: ParamMap) => {
      const id = Number(params.get('id'));

      this.product = null;
      this.errorMessage = '';
      this.cartMessage = '';

      if (!Number.isInteger(id) || id <= 0) {
        this.productId = undefined;
        this.errorMessage = 'Invalid product ID.';
        return;
      }

      this.productId = id;
      this.loadProduct(id);
    });
  }

  loadProduct(id: number): void {
    this.loading = true;

    this.productService.getProductById(id).subscribe({
      next: (product) => {
        this.product = product;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load product:', error);

        this.errorMessage =
          error.status === 404
            ? 'Product not found.'
            : 'Could not load product. Please try again.';

        this.loading = false;
      }
    });
  }

  addToCart(): void {
    if (!this.product) {
      return;
    }

    const result = this.cartService.addProduct(this.product);

    this.cartMessage = result.message;
    this.cartMessageType = result.success ? 'success' : 'error';

    if (result.success) {
      this.cartService.openDrawer();
    }
  }

  openCart(): void {
    this.cartService.openDrawer();
  }

  get cartItemCount(): number {
    return this.cartService.getItemCount();
  }

}

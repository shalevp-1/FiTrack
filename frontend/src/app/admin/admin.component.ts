
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const LOW_STOCK_THRESHOLD = 5;
const MAX_PRODUCT_STOCK = 2147483647;

interface RecentOrder {
  id: number;
  created_at: string;
  total_amount: string;
  status: string;
  payment_status: string;
  username: string;
}

interface InventoryProduct {
  id: number;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  category: string | null;
  stock_quantity: number;
  is_active: boolean | number;
  has_order_history: boolean | number;
}

interface ProductForm {
  name: string;
  description: string;
  price: number | null;
  image_url: string;
  category: string;
  stock_quantity: number | null;
}

type InventoryFilter = 'all' | 'low-stock' | 'out-of-stock';

interface AdminOverview {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  recentOrders: RecentOrder[];
}

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  readonly lowStockThreshold = LOW_STOCK_THRESHOLD;
  overview: AdminOverview | null = null;
  loading = true;
  error = '';
  inventoryProducts: InventoryProduct[] = [];
  inventoryLoading = true;
  inventoryError = '';
  inventoryMessage = '';
  inventoryMessageType: 'success' | 'error' = 'success';
  searchTerm = '';
  inventoryFilter: InventoryFilter = 'all';
  restockProduct: InventoryProduct | null = null;
  restockQuantity = 1;
  restocking = false;
  productEditorMode: 'create' | 'edit' | null = null;
  productForm: ProductForm = this.emptyProductForm();
  productSaving = false;
  deactivatingProductId: number | null = null;
  reactivatingProductId: number | null = null;
  deletingProductId: number | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadOverview();
    this.loadInventory();
  }

  loadOverview(): void {
    this.http.get<AdminOverview>(
      '/api/admin/overview',
      { withCredentials: true }
    ).subscribe({
      next: (data) => {
        this.overview = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load admin overview:', err);
        this.error = 'Could not load dashboard data.';
        this.loading = false;
      }
    });
  }

  reactivateProduct(product: InventoryProduct): void {
    if (product.is_active || this.reactivatingProductId !== null) {
      return;
    }

    this.reactivatingProductId = product.id;
    this.inventoryMessage = '';

    this.http.patch<{ message: string }>(
      `/api/admin/inventory/${product.id}/reactivate`,
      {},
      { withCredentials: true }
    ).subscribe({
      next: response => {
        this.inventoryProducts = this.inventoryProducts.map(item =>
          item.id === product.id ? { ...item, is_active: 1 } : item
        );
        this.inventoryMessage = response.message;
        this.inventoryMessageType = 'success';
        this.reactivatingProductId = null;
        this.loadOverview();
      },
      error: error => {
        console.error('Failed to reactivate product:', error);
        this.inventoryMessage =
          error?.error?.message || 'Could not reactivate product.';
        this.inventoryMessageType = 'error';
        this.reactivatingProductId = null;
      }
    });
  }

  deleteProduct(product: InventoryProduct): void {
    if (
      product.is_active ||
      product.has_order_history ||
      this.deletingProductId !== null ||
      !window.confirm(
        `Permanently delete "${product.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    this.deletingProductId = product.id;
    this.inventoryMessage = '';

    this.http.delete<{ message: string }>(
      `/api/admin/inventory/${product.id}`,
      { withCredentials: true }
    ).subscribe({
      next: response => {
        this.inventoryProducts = this.inventoryProducts.filter(
          item => item.id !== product.id
        );
        this.inventoryMessage = response.message;
        this.inventoryMessageType = 'success';
        this.deletingProductId = null;
        this.loadOverview();
      },
      error: error => {
        console.error('Failed to delete product:', error);
        this.inventoryMessage =
          error?.error?.message || 'Could not delete product.';
        this.inventoryMessageType = 'error';
        this.deletingProductId = null;
      }
    });
  }

  loadInventory(): void {
    this.inventoryLoading = true;
    this.inventoryError = '';

    this.http.get<InventoryProduct[]>(
      '/api/admin/inventory',
      { withCredentials: true }
    ).subscribe({
      next: products => {
        this.inventoryProducts = products;
        this.inventoryLoading = false;
      },
      error: error => {
        console.error('Failed to load inventory:', error);
        this.inventoryError =
          error?.error?.message || 'Could not load inventory.';
        this.inventoryLoading = false;
      }
    });
  }

  get filteredInventoryProducts(): InventoryProduct[] {
    const query = this.searchTerm.trim().toLocaleLowerCase();

    return this.inventoryProducts.filter(product => {
      const matchesSearch = product.name.toLocaleLowerCase().includes(query);
      const matchesFilter =
        this.inventoryFilter === 'all' ||
        (
          this.inventoryFilter === 'low-stock' &&
          product.stock_quantity > 0 &&
          product.stock_quantity <= LOW_STOCK_THRESHOLD
        ) ||
        (
          this.inventoryFilter === 'out-of-stock' &&
          product.stock_quantity === 0
        );

      return matchesSearch && matchesFilter;
    });
  }

  get lowStockCount(): number {
    return this.inventoryProducts.filter(
      product =>
        product.stock_quantity > 0 &&
        product.stock_quantity <= LOW_STOCK_THRESHOLD
    ).length;
  }

  get outOfStockCount(): number {
    return this.inventoryProducts.filter(
      product => product.stock_quantity === 0
    ).length;
  }

  getStockStatus(product: InventoryProduct): string {
    if (product.stock_quantity === 0) {
      return 'Out of stock';
    }

    return product.stock_quantity <= LOW_STOCK_THRESHOLD
      ? 'Low stock'
      : 'In stock';
  }

  openCreateProductForm(): void {
    this.productEditorMode = 'create';
    this.editingProductId = null;
    this.productForm = this.emptyProductForm();
    this.inventoryMessage = '';
  }

  openEditProductForm(product: InventoryProduct): void {
    this.productEditorMode = 'edit';
    this.editingProductId = product.id;
    this.productForm = {
      name: product.name,
      description: product.description || '',
      price: Number(product.price),
      image_url: product.image_url || '',
      category: product.category || '',
      stock_quantity: product.stock_quantity
    };
    this.inventoryMessage = '';
  }

  closeProductForm(): void {
    if (!this.productSaving) {
      this.productEditorMode = null;
    }
  }

  saveProduct(): void {
    if (this.productSaving || !this.productEditorMode) {
      return;
    }

    const form = this.productForm;
    const stockQuantity = form.stock_quantity;
    if (
      !form.name.trim() ||
      form.name.trim().length > 150 ||
      form.price === null ||
      !Number.isFinite(form.price) ||
      form.price < 0 ||
      Math.round(form.price * 100) !== form.price * 100 ||
      stockQuantity === null ||
      !Number.isSafeInteger(stockQuantity) ||
      stockQuantity < 0 ||
      stockQuantity > MAX_PRODUCT_STOCK ||
      form.description.length > 65535 ||
      form.image_url.length > 500 ||
      form.category.length > 100
    ) {
      this.inventoryMessage =
        'Check the product name, price, stock, image, and category fields.';
      this.inventoryMessageType = 'error';
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: form.price,
      image_url: form.image_url.trim() || null,
      category: form.category.trim() || null,
      stock_quantity: stockQuantity
    };

    this.productSaving = true;
    this.inventoryMessage = '';

    const request = this.productEditorMode === 'create'
      ? this.http.post<{ message: string; product: InventoryProduct }>(
        '/api/admin/inventory',
        payload,
        { withCredentials: true }
      )
      : this.http.put<{ message: string; product: InventoryProduct }>(
        `/api/admin/inventory/${this.editingProductId}`,
        payload,
        { withCredentials: true }
      );

    request.subscribe({
      next: response => {
        this.inventoryProducts = this.productEditorMode === 'create'
          ? [...this.inventoryProducts, response.product]
          : this.inventoryProducts.map(product =>
            product.id === response.product.id ? response.product : product
          );
        this.inventoryMessage = response.message;
        this.inventoryMessageType = 'success';
        this.productSaving = false;
        this.productEditorMode = null;
        this.editingProductId = null;
        this.loadOverview();
      },
      error: error => {
        console.error('Failed to save product:', error);
        this.inventoryMessage =
          error?.error?.message || 'Could not save product.';
        this.inventoryMessageType = 'error';
        this.productSaving = false;
      }
    });
  }

  deactivateProduct(product: InventoryProduct): void {
    if (
      !product.is_active ||
      this.deactivatingProductId !== null ||
      !window.confirm(`Deactivate "${product.name}"? It will no longer be available for sale.`)
    ) {
      return;
    }

    this.deactivatingProductId = product.id;
    this.inventoryMessage = '';

    this.http.patch<{ message: string }>(
      `/api/admin/inventory/${product.id}/deactivate`,
      {},
      { withCredentials: true }
    ).subscribe({
      next: response => {
        this.inventoryProducts = this.inventoryProducts.map(item =>
          item.id === product.id ? { ...item, is_active: 0 } : item
        );
        this.inventoryMessage = response.message;
        this.inventoryMessageType = 'success';
        this.deactivatingProductId = null;
        this.loadOverview();
      },
      error: error => {
        console.error('Failed to deactivate product:', error);
        this.inventoryMessage =
          error?.error?.message || 'Could not deactivate product.';
        this.inventoryMessageType = 'error';
        this.deactivatingProductId = null;
      }
    });
  }

  openRestockForm(product: InventoryProduct): void {
    this.restockProduct = product;
    this.restockQuantity = 1;
    this.inventoryMessage = '';
  }

  closeRestockForm(): void {
    if (!this.restocking) {
      this.restockProduct = null;
    }
  }

  restock(): void {
    if (
      !this.restockProduct ||
      this.restocking ||
      !Number.isSafeInteger(this.restockQuantity) ||
      this.restockQuantity <= 0
    ) {
      this.inventoryMessage =
        'Enter a positive whole-number quantity to restock.';
      this.inventoryMessageType = 'error';
      return;
    }

    const productId = this.restockProduct.id;
    this.restocking = true;
    this.inventoryMessage = '';

    this.http.post<{
      message: string;
      product: InventoryProduct;
    }>(
      `/api/admin/inventory/${productId}/restock`,
      { quantity: this.restockQuantity },
      { withCredentials: true }
    ).subscribe({
      next: response => {
        this.inventoryProducts = this.inventoryProducts.map(product =>
          product.id === response.product.id ? response.product : product
        );
        this.inventoryMessage = response.message;
        this.inventoryMessageType = 'success';
        this.restocking = false;
        this.restockProduct = null;
        this.loadOverview();
      },
      error: error => {
        console.error('Failed to restock product:', error);
        this.inventoryMessage =
          error?.error?.message || 'Could not restock product.';
        this.inventoryMessageType = 'error';
        this.restocking = false;
      }
    });
  }

  private editingProductId: number | null = null;

  private emptyProductForm(): ProductForm {
    return {
      name: '',
      description: '',
      price: null,
      image_url: '',
      category: '',
      stock_quantity: 0
    };
  }
}

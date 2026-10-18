import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { AdminComponent } from './admin.component';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;
  let post: jasmine.Spy;
  let put: jasmine.Spy;
  let patch: jasmine.Spy;
  let deleteRequest: jasmine.Spy;

  beforeEach(() => {
    const products = [
      {
        id: 1,
        name: 'Training mat',
        description: 'Exercise mat',
        price: '25.00',
        image_url: '/assets/mat.jpg',
        category: 'Fitness',
        stock_quantity: 3,
        is_active: 1,
        has_order_history: 0
      },
      {
        id: 2,
        name: 'Water bottle',
        description: null,
        price: '10.00',
        image_url: null,
        category: null,
        stock_quantity: 0,
        is_active: 1,
        has_order_history: 0
      },
      {
        id: 3,
        name: 'Gym bag',
        description: null,
        price: '40.00',
        image_url: null,
        category: 'Accessories',
        stock_quantity: 12,
        is_active: 1,
        has_order_history: 0
      }
    ];
    const overview = {
      totalSales: 0,
      totalOrders: 0,
      totalProducts: products.length,
      lowStockProducts: 1,
      recentOrders: []
    };
    post = jasmine.createSpy('post').and.returnValue(of({
      message: 'Training mat restocked successfully',
      product: { ...products[0], stock_quantity: 13 }
    }));
    put = jasmine.createSpy('put').and.returnValue(of({
      message: 'Training mat updated successfully',
      product: { ...products[0], description: 'Updated mat' }
    }));
    patch = jasmine.createSpy('patch').and.returnValue(of({
      message: 'Product updated successfully'
    }));
    deleteRequest = jasmine.createSpy('delete').and.returnValue(of({
      message: 'Training mat deleted permanently'
    }));

    TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule],
      declarations: [AdminComponent],
      providers: [{
        provide: HttpClient,
        useValue: {
          get: (url: string) =>
            url.endsWith('/inventory') ? of(products) : of(overview),
          post,
          put,
          patch,
          delete: deleteRequest
        }
      }]
    });
    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('filters products by name and stock status', () => {
    component.searchTerm = 'mat';
    component.inventoryFilter = 'low-stock';

    expect(component.filteredInventoryProducts.map(product => product.id))
      .toEqual([1]);

    component.searchTerm = '';
    component.inventoryFilter = 'out-of-stock';
    expect(component.filteredInventoryProducts.map(product => product.id))
      .toEqual([2]);
  });

  it('sends the restock quantity and updates existing stock', () => {
    component.openRestockForm(component.inventoryProducts[0]);
    component.restockQuantity = 10;
    component.restock();

    expect(post).toHaveBeenCalledWith(
      '/api/admin/inventory/1/restock',
      { quantity: 10 },
      { withCredentials: true }
    );
    expect(component.inventoryProducts[0].stock_quantity).toBe(13);
    expect(component.inventoryProducts.length).toBe(3);
  });

  it('saves product edits through the admin product endpoint', () => {
    component.openEditProductForm(component.inventoryProducts[0]);
    component.productForm.description = 'Updated mat';
    component.saveProduct();

    expect(put).toHaveBeenCalledWith(
      '/api/admin/inventory/1',
      jasmine.objectContaining({
        description: 'Updated mat',
        stock_quantity: 3
      }),
      { withCredentials: true }
    );
    expect(component.inventoryProducts[0].description).toBe('Updated mat');
  });

  it('creates a product without modifying existing products', () => {
    post.and.returnValue(of({
      message: 'New product added successfully',
      product: {
        id: 4,
        name: 'New product',
        description: null,
        price: '12.00',
        image_url: null,
        category: null,
        stock_quantity: 2,
        is_active: 1,
        has_order_history: 0
      }
    }));
    component.openCreateProductForm();
    component.productForm = {
      name: 'New product',
      description: '',
      price: 12,
      image_url: '',
      category: '',
      stock_quantity: 2
    };
    component.saveProduct();

    expect(post).toHaveBeenCalledWith(
      '/api/admin/inventory',
      jasmine.objectContaining({ name: 'New product', stock_quantity: 2 }),
      { withCredentials: true }
    );
    expect(component.inventoryProducts.length).toBe(4);
  });

  it('deactivates a product without deleting it', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.deactivateProduct(component.inventoryProducts[0]);

    expect(patch).toHaveBeenCalledWith(
      '/api/admin/inventory/1/deactivate',
      {},
      { withCredentials: true }
    );
    expect(component.inventoryProducts[0].is_active).toBe(0);
    expect(component.inventoryProducts.length).toBe(3);
  });

  it('reactivates a product in place', () => {
    const product = {
      ...component.inventoryProducts[0],
      is_active: 0
    };
    component.inventoryProducts[0] = product;

    component.reactivateProduct(product);

    expect(patch).toHaveBeenCalledWith(
      '/api/admin/inventory/1/reactivate',
      {},
      { withCredentials: true }
    );
    expect(component.inventoryProducts[0].is_active).toBe(1);
    expect(component.inventoryProducts.length).toBe(3);
  });

  it('permanently deletes an inactive product without order history', () => {
    spyOn(window, 'confirm').and.returnValue(true);

    component.deleteProduct({
      ...component.inventoryProducts[0],
      is_active: 0
    });

    expect(deleteRequest).toHaveBeenCalledWith(
      '/api/admin/inventory/1',
      { withCredentials: true }
    );
    expect(component.inventoryProducts.map(item => item.id)).toEqual([2, 3]);
  });

  it('does not delete active products or products linked to orders', () => {
    spyOn(window, 'confirm').and.returnValue(true);

    component.deleteProduct(component.inventoryProducts[0]);
    component.deleteProduct({
      ...component.inventoryProducts[0],
      is_active: 0,
      has_order_history: 1
    });

    expect(deleteRequest).not.toHaveBeenCalled();
    expect(component.inventoryProducts.length).toBe(3);
  });
});

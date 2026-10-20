import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { ProductsComponent } from './products.component';
import { ProductService } from '../services/product.service';
import { CartService } from '../services/cart.service';

describe('ProductsComponent', () => {
  let component: ProductsComponent;
  let fixture: ComponentFixture<ProductsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProductsComponent],
      imports: [CommonModule, RouterTestingModule],
      providers: [
        { provide: ProductService, useValue: { getProducts: () => of([]) } },
        {
          provide: CartService,
          useValue: {
            getItemCount: () => 0,
            addProduct: () => ({ success: true, message: '' }),
            openDrawer: () => undefined
          }
        }
      ]
    });
    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

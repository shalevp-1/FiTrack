import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { ProductDetailViewComponent } from './product-detail-view.component';
import { ProductService } from '../services/product.service';
import { CartService } from '../services/cart.service';

describe('ProductDetailViewComponent', () => {
  let component: ProductDetailViewComponent;
  let fixture: ComponentFixture<ProductDetailViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProductDetailViewComponent],
      imports: [CommonModule, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: '0' })) }
        },
        { provide: ProductService, useValue: { getProductById: () => of(null) } },
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
    fixture = TestBed.createComponent(ProductDetailViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

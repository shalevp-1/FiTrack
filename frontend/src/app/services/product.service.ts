import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  category: string | null;
  stock_quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = '/api/products';

  constructor(private http: HttpClient) { }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl, {
      withCredentials: true
    });
  }

  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

}

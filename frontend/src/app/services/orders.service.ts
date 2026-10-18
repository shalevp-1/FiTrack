
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Order {
  id: number;
  created_at: string;
  subtotal: number;
  discount_amount: number;
  shipping_cost: number;
  total_amount: number;
  status: string;
  payment_status: string;
  line_count: number;
  item_count: number;
}



export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number | string;
}

export interface OrderDetails extends Order {
  items: OrderItem[];
}


@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private apiUrl = '/api/orders';

  constructor(private http: HttpClient) {}

  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(
      `${this.apiUrl}/my-orders`,
      { withCredentials: true }
    );
  }

  
getMyOrderById(id: number): Observable<OrderDetails> {
  return this.http.get<OrderDetails>(
    `${this.apiUrl}/my-orders/${id}`,
    { withCredentials: true }
  );
}
}

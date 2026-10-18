
import { Component, OnInit } from '@angular/core';
import { OrdersService, Order, OrderDetails } from '../services/orders.service';

@Component({
  selector: 'app-my-orders',
  templateUrl: './my-orders.component.html',
  styleUrls: ['./my-orders.component.css']
})
export class MyOrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = true;
  errorMessage = '';

  expandedOrderId: number | null = null;
  expandedOrder: OrderDetails | null = null;
  loadingOrderDetailsId: number | null = null;
  detailsError = '';

  constructor(private ordersService: OrdersService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.errorMessage = '';

    this.ordersService.getMyOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load orders:', error);

        this.errorMessage =
          error.status === 401
            ? 'Your session may have expired. Please log in again.'
            : 'We could not load your orders. Please try again.';

        this.loading = false;
      }
    });
  }

  countCompleted(): number {
    return this.orders.filter(
      order => order.status.toLowerCase() === 'completed'
    ).length;
  }

  toggleOrderDetails(orderId: number): void {
    // Close the currently expanded order
    if (this.expandedOrderId === orderId) {
      this.expandedOrderId = null;
      this.expandedOrder = null;
      this.loadingOrderDetailsId = null;
      this.detailsError = '';
      return;
    }

    // Open the selected order and fetch its items
    this.expandedOrderId = orderId;
    this.expandedOrder = null;
    this.loadingOrderDetailsId = orderId;
    this.detailsError = '';

    this.ordersService.getMyOrderById(orderId).subscribe({
      next: (details) => {
        if (this.expandedOrderId === orderId) {
          this.expandedOrder = details;
        }

        if (this.loadingOrderDetailsId === orderId) {
          this.loadingOrderDetailsId = null;
        }
      },
      error: (error) => {
        console.error('Failed to load order details:', error);

        if (this.expandedOrderId === orderId) {
          this.detailsError = 'Could not load the items for this order.';
        }

        if (this.loadingOrderDetailsId === orderId) {
          this.loadingOrderDetailsId = null;
        }
      }
    });
  }

  getLineTotal(item: {
    unit_price: number | string;
    quantity: number;
  }): number {
    return Number(item.unit_price) * item.quantity;
  }
}

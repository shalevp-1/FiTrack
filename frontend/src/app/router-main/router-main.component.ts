
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit
} from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  CartItem,
  CartService
} from '../services/cart.service';

@Component({
  selector: 'app-router-main',
  templateUrl: './router-main.component.html',
  styleUrls: ['./router-main.component.css']
})
export class RouterMainComponent implements OnInit, OnDestroy {

  isLoggedIn = false;
  isAdmin = false;
  isPhotoRoute = false;
  isNavHidden = false;
  isNavScrolled = false;

  cartItems: CartItem[] = [];

  private lastScrollY = 0;
  private routeSubscription: Subscription | null = null;
  private cartSubscription: Subscription | null = null;
  private loginStatusSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cartService: CartService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.checkLogin();

    this.updatePhotoRoute();
    this.onWindowScroll();

    this.routeSubscription = this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd =>
            event instanceof NavigationEnd
        )
      )
      .subscribe(() => {
        this.updatePhotoRoute();
        this.isNavHidden = false;
        this.lastScrollY = window.scrollY;
        this.isNavScrolled = window.scrollY > 10;
      });

    this.cartSubscription = this.cartService.items$.subscribe(items => {
      this.cartItems = items;
    });

    this.loginStatusSubscription =
      this.authService.loginStatus$.subscribe(loggedIn => {
        this.isLoggedIn = loggedIn;

        if (!loggedIn) {
          this.isAdmin = false;
        } else {
          this.loadUserRole();
        }
      });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.cartSubscription?.unsubscribe();
    this.loginStatusSubscription?.unsubscribe();
  }

  get isStoreRoute(): boolean {
    const route = this.router.url.split(/[?#]/)[0];

    return route === '/products' || route.startsWith('/products/');
  }

  get cartItemCount(): number {
    return this.cartItems.reduce(
      (total, item) => total + item.quantity,
      0
    );
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const currentScrollY = window.scrollY;

    this.isNavHidden =
      currentScrollY > 90 && currentScrollY > this.lastScrollY;

    this.isNavScrolled = currentScrollY > 10;
    this.lastScrollY = currentScrollY;
  }

  private updatePhotoRoute(): void {
    const route = this.router.url.split(/[?#]/)[0];

    this.isPhotoRoute = [
      '/home',
      '/login',
      '/register',
      '/dashboard',
      '/workouts'
    ].some(path => route === path || route.startsWith(`${path}/`));
  }

  checkLogin(): void {
    this.http.get<any>(
      '/api/me',
      { withCredentials: true }
    ).subscribe({
      next: response => {
        if (response.loggedIn && response.user?.id) {
          this.isLoggedIn = true;
          this.isAdmin = response.user.role === 'admin';
          this.cartService.setUser(response.user.id);
          this.authService.setLoggedIn();
        } else {
          this.isLoggedIn = false;
          this.isAdmin = false;
          this.cartService.setUser(null);
          this.authService.setLoggedOut();
        }
      },
      error: () => {
        this.isLoggedIn = false;
        this.isAdmin = false;
        this.cartService.setUser(null);
        this.authService.setLoggedOut();
      }
    });
  }

  private loadUserRole(): void {
    this.http.get<any>(
      '/api/me',
      { withCredentials: true }
    ).subscribe({
      next: response => {
        this.isAdmin =
          response.loggedIn && response.user?.role === 'admin';
      },
      error: () => {
        this.isAdmin = false;
      }
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.cartService.setUser(null);
        this.authService.setLoggedOut();
        this.isLoggedIn = false;
        this.isAdmin = false;
        this.router.navigate(['/home']);
      },
      error: error => {
        console.error('Logout failed:', error);
      }
    });
  }
}

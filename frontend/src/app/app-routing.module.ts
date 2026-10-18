import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { RouterMainComponent } from './router-main/router-main.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ContactusComponent } from './contactus/contactus.component';
import { ProductsComponent } from './products/products.component';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { ProductDetailViewComponent } from './product-detail-view/product-detail-view.component';
import { CartComponent } from './cart/cart.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { MyOrdersComponent } from './my-orders/my-orders.component';



const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 'products/:id', component: ProductDetailViewComponent },
  { path: 'products', component: ProductsComponent },
  { path: 'cart', component: CartComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'contactus', component: ContactusComponent },
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./dashboard/dashboard.module').then(module => module.DashboardModule)
  },
  {
    path: 'workouts',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./workouts/workouts.module').then(module => module.WorkoutsModule)
  },
  {
    path: 'my-orders',
    component: MyOrdersComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'admin',
    canActivate: [AdminGuard],
    loadChildren: () =>
      import('./admin/admin.module').then(module => module.AdminModule)
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', redirectTo: '/home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

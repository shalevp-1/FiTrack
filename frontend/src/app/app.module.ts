import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { RouterMainComponent } from './router-main/router-main.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ContactusComponent } from './contactus/contactus.component';
import { ProductsComponent } from './products/products.component';
import { ProductDetailViewComponent } from './product-detail-view/product-detail-view.component';
import { CartComponent } from './cart/cart.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { MyOrdersComponent } from './my-orders/my-orders.component';
import { CartDrawerComponent } from './cart-drawer/cart-drawer.component';
import { BackendStatusComponent } from './backend-status/backend-status.component';
import { ApiBaseUrlInterceptor } from './api-base-url.interceptor';




@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    RouterMainComponent,
    LoginComponent,
    RegisterComponent,
    ContactusComponent,
    ProductsComponent,
    ProductDetailViewComponent,
    CartComponent,
    CheckoutComponent,
    MyOrdersComponent,
    CartDrawerComponent,
    BackendStatusComponent,

  ],

  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule
  ],

  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiBaseUrlInterceptor,
      multi: true
    }
  ],

  bootstrap: [AppComponent]
})
export class AppModule { }
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { AppComponent } from './app.component';

@Component({ selector: 'app-router-main', template: '' })
class RouterMainStubComponent {}

@Component({ selector: 'app-cart-drawer', template: '' })
class CartDrawerStubComponent {}

@Component({ selector: 'app-backend-status', template: '' })
class BackendStatusStubComponent {}

describe('AppComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    declarations: [
      AppComponent,
      RouterMainStubComponent,
      CartDrawerStubComponent,
      BackendStatusStubComponent
    ]
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'frontend'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('frontend');
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main app-router-main')).toBeTruthy();
    expect(compiled.querySelector('main app-cart-drawer')).toBeTruthy();
    expect(compiled.querySelector('main app-backend-status')).toBeTruthy();
  });
});

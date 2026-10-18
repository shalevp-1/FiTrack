import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RouterMainComponent } from './router-main.component';

describe('RouterMainComponent', () => {
  let component: RouterMainComponent;
  let fixture: ComponentFixture<RouterMainComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RouterMainComponent]
    });
    fixture = TestBed.createComponent(RouterMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

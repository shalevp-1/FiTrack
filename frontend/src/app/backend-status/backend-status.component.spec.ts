import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import {
  ComponentFixture,
  discardPeriodicTasks,
  fakeAsync,
  TestBed,
  tick
} from '@angular/core/testing';
import { BackendStatusComponent } from './backend-status.component';

describe('BackendStatusComponent', () => {
  let fixture: ComponentFixture<BackendStatusComponent>;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [BackendStatusComponent]
    });

    fixture = TestBed.createComponent(BackendStatusComponent);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
    fixture.destroy();
  });

  it('shows startup status while the server is unavailable and celebrates recovery', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    httpTestingController.expectOne('/api/health')
      .flush({ status: 'starting' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    expect(fixture.componentInstance.serverStarting).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Server is starting up');

    tick(5000);
    httpTestingController.expectOne('/api/health')
      .flush({ status: 'ok' });
    fixture.detectChanges();

    expect(fixture.componentInstance.serverStarting).toBeFalse();
    expect(fixture.componentInstance.showRecoveredNotice).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Server is back online');
    expect(fixture.nativeElement.querySelectorAll('.confetti i').length).toBe(24);

    tick(4000);
    fixture.detectChanges();
    expect(fixture.componentInstance.showRecoveredNotice).toBeFalse();
    discardPeriodicTasks();
  }));
});

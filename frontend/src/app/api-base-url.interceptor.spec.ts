import {
  HTTP_INTERCEPTORS,
  HttpClient
} from '@angular/common/http';
import {
  HttpTestingController,
  HttpClientTestingModule
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiBaseUrlInterceptor } from './api-base-url.interceptor';

describe('ApiBaseUrlInterceptor', () => {
  let http: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: HTTP_INTERCEPTORS,
          useClass: ApiBaseUrlInterceptor,
          multi: true
        }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('keeps relative API requests under /api and sends credentials', () => {
    http.get('/api/health').subscribe();

    const request = httpTestingController.expectOne('/api/health');
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ status: 'ok' });
  });

  it('does not rewrite non-API requests', () => {
    http.get('/assets/example.json').subscribe();

    const request = httpTestingController.expectOne('/assets/example.json');
    expect(request.request.withCredentials).toBeFalse();
    request.flush({});
  });
});

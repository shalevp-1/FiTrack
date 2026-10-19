import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable()
export class ApiBaseUrlInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    if (request.url !== '/api' && !request.url.startsWith('/api/')) {
      return next.handle(request);
    }

    const apiPath = request.url.slice('/api'.length);
    return next.handle(
      request.clone({
        url: `${environment.apiBaseUrl}${apiPath}`,
        withCredentials: true
      })
    );
  }
}

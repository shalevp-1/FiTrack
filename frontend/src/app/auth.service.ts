import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = '/api';

  private loginStatus = new Subject<boolean>();

  loginStatus$ = this.loginStatus.asObservable();

  constructor(private http: HttpClient) {}

checkLogin(): Observable<boolean> {
  return this.http.get<any>(
    `${this.apiUrl}/me`,
    {
      withCredentials: true
    }
  ).pipe(
    map(response => response.loggedIn === true)
  );
}

checkAdmin(): Observable<boolean> {
  return this.http.get<any>(
    `${this.apiUrl}/me`,
    {
      withCredentials: true
    }
  ).pipe(
    map(response =>
      response.loggedIn === true &&
      response.user?.role === 'admin'
    )
  );
}
  setLoggedIn(): void {
    this.loginStatus.next(true);
  }

  setLoggedOut(): void {
    this.loginStatus.next(false);
  }

  logout(): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/logout`,
      {},
      {
        withCredentials: true
      }
    );
  }
}
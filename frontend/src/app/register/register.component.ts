import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {

  username = '';
  email = '';
  password = '';

  errorMessage = '';
  successMessage = '';

  constructor(private http: HttpClient) {}

  register() {
    this.errorMessage = '';
    this.successMessage = '';

    this.http.post<any>(
      '/api/users',
      {
        username: this.username,
        email: this.email,
        password: this.password
      }
    ).subscribe({
      next: (response) => {
        this.successMessage = response.message;

        this.username = '';
        this.email = '';
        this.password = '';
      },

      error: (error) => {
        this.errorMessage =
          error.error?.message || 'Something went wrong';
      }
    });
  }
}
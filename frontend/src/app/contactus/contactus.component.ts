
import { Component } from '@angular/core';

@Component({
  selector: 'app-contactus',
  templateUrl: './contactus.component.html',
  styleUrls: ['./contactus.component.css']
})
export class ContactusComponent {

  contact = {
    name: '',
    email: '',
    subject: '',
    message: ''
  };

  sendMessage(): void {
    console.log('Contact form submitted:', this.contact);

    alert('Thanks for contacting Fitrack! Your message has been received.');

    this.contact = {
      name: '',
      email: '',
      subject: '',
      message: ''
    };
  }

}

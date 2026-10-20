import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren
} from '@angular/core';
import { AuthService } from '../auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

  isLoggedIn = false;

  @ViewChildren('homeReveal', { read: ElementRef })
  private revealElements!: QueryList<ElementRef<HTMLElement>>;

  private revealObserver: IntersectionObserver | null = null;
  private revealChangesSubscription: Subscription | null = null;
  private loginStatusSubscription: Subscription | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {

    this.checkLogin();

    this.loginStatusSubscription = this.authService.loginStatus$.subscribe(
      loggedIn => {
        this.isLoggedIn = loggedIn;
      }
    );
  }

  ngAfterViewInit(): void {
    this.revealChangesSubscription =
      this.revealElements.changes.subscribe(() => this.observeRevealElements());
    this.observeRevealElements();
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.revealChangesSubscription?.unsubscribe();
    this.loginStatusSubscription?.unsubscribe();
  }

  private observeRevealElements(): void {
    this.revealObserver?.disconnect();

    if (typeof IntersectionObserver === 'undefined') {
      this.revealElements.forEach(item =>
        item.nativeElement.classList.add('reveal-visible')
      );
      return;
    }

    this.revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
          } else {
            entry.target.classList.remove('reveal-visible');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -35px 0px' }
    );

    this.revealElements.forEach(item => {
      this.revealObserver?.observe(item.nativeElement);
    });
  }

 checkLogin(): void {
  this.authService.checkLogin().subscribe((loggedIn) => {
    this.isLoggedIn = loggedIn;
  });
}
}
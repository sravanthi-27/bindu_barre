import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  // Method to set the login state
  setLoggedIn(value: boolean): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('isLoggedIn', JSON.stringify(value));
    }
  }

  // Method to check if the user is logged in
  isLoggedIn(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return JSON.parse(localStorage.getItem('isLoggedIn') || 'false');
    }
    return false; // Default to false if not in the browser
  }
}
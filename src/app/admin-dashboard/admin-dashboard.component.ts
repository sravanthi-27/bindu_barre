import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AccommodationComponent } from '../accommodation/accommodation.component';
import { FeedbackComponent } from '../feedback/feedback.component';
import { AgentRegComponent } from '../agent-reg/agent-reg.component';
import { RegComponent } from '../reg/reg.component';
import { HttpClient } from '@angular/common/http'; // Import HttpClient
import * as Papa from 'papaparse'; // Import PapaParse

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    AccommodationComponent,
    FeedbackComponent,
    AgentRegComponent,
    RegComponent,
    RouterLink,
    RouterOutlet
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent {
  showNavbar: boolean = true; 
  activeSection: string = 'Accommodation';
  showSection: string = ''; 
  csvData: any[] = []; // To hold parsed CSV data

  constructor(private http: HttpClient) {} // Inject HttpClient

  // Update the active section
  setActiveSection(section: string): void {
    this.activeSection = section;
    this.showSection = section; // Set the showSection based on the active section

    // Load CSV data when the Accommodation section is active
    if (section === 'Accommodation') {
      this.loadCSV(); // Call loadCSV to fetch data
    }
  }

  // Method to load and parse CSV data
  loadCSV(): void {
    this.http.get('assets/accommodation.csv', { responseType: 'text' })
      .subscribe(
        (data: string) => { // Specify the type of data
          this.csvData = Papa.parse(data, { header: true }).data; // Parse CSV into JSON
        },
        (error: any) => {
          console.error('Error loading CSV file:', error);
        }
      );
  }

  navigateToCSV(): void {
    // Construct the URL for your CSV file
    const csvUrl = 'assets/accommodation.csv'; // Use relative URL for assets
    window.open(csvUrl, '_blank'); // Open CSV in a new tab
  }
}

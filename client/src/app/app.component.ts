import { Component } from '@angular/core';
import { VERSION } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public counter = 0;

  get angularVersion(): string {
    return VERSION.full;
  }

  inc() {
    this.counter++;
  }

  dec() {
    this.counter--;
  }
}

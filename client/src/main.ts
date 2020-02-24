import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

import 'zone.js/dist/zone';

declare var AJS: any;

const bootstrap = () => {
  platformBrowserDynamic()
    .bootstrapModule(AppModule)
    .catch(err => console.error(err));
};

if (environment.production) {
  enableProdMode();
  AJS.toInit(() => {
    bootstrap();
  });
} else {
  bootstrap();
}

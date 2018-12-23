import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { environment } from '../environments/environment';
import { VSAppModule } from './vsapp.module';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(VSAppModule)
  .catch(err => console.error(err));

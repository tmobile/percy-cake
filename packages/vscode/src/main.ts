import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { VSAppModule } from './vsapp.module';

enableProdMode();

platformBrowserDynamic().bootstrapModule(VSAppModule)
  .catch(err => console.error(err));

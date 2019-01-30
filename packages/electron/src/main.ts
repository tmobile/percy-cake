import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { ElectronAppModule } from './app.module';

enableProdMode();

platformBrowserDynamic().bootstrapModule(ElectronAppModule)
  .catch(err => console.error(err));

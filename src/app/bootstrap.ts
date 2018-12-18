import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { environment } from '../environments/environment';

if (environment.production) {
  enableProdMode();
}

export default platformBrowserDynamic;

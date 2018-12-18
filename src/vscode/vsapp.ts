import platformBrowserDynamic from 'bootstrap';
import { VSAppModule } from './vsapp.module';

platformBrowserDynamic().bootstrapModule(VSAppModule)
  .catch(err => console.error(err));

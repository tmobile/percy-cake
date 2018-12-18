import platformBrowserDynamic from 'bootstrap';
import { AppModule } from './app.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

import { NgModule } from '@angular/core';

// Common
import { CommonModule } from 'common.module';

// main app component
import { VSAppComponent } from './vsapp.component';

import { StoreModule } from '@ngrx/store';
import { reducers } from 'store';
import { EffectsModule } from '@ngrx/effects';
import { AppEffects } from 'store/affects/app.effects';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    VSAppComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forRoot([]),
    StoreModule.forRoot(reducers),
    EffectsModule.forRoot([AppEffects])
  ],
  bootstrap: [VSAppComponent]
})
export class VSAppModule { }

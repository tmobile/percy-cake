import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

// Common
import { CommonModule } from 'common.module';

import { reducers } from 'store';
import { AppEffects } from 'store/affects/app.effects';

// main app component
import { VSAppComponent } from './vsapp.component';

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

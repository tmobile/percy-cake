import { Injectable } from '@angular/core';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import * as _ from 'lodash';

import * as appStore from '..';

// defines the dashboard page related effects
@Injectable()
export class DashboardEffects {
  constructor(
    private actions$: Actions,
    private store: Store<appStore.AppState>
  ) { }
}

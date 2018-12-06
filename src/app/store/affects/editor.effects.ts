import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { map, withLatestFrom, switchMap } from 'rxjs/operators';
import * as _ from 'lodash';

import { appPercyConfig } from 'config';
import * as appStore from '..';
import { APIError } from '../actions/common.actions';
import {
  EditorActionTypes,
  PageLoad,
  PageLoadSuccess,
  PageLoadFailure,
} from '../actions/editor.actions';
import { FileManagementService } from 'services/file-management.service';

// defines the editor page related effects
@Injectable()
export class EditorEffects {
  constructor(
    private actions$: Actions,
    private store: Store<appStore.AppState>,
    private fileManagementService: FileManagementService,
  ) { }

  // handles the page load request
  @Effect()
  pageLoad$ = this.actions$.pipe(
    ofType<PageLoad>(EditorActionTypes.PageLoad),
    withLatestFrom(this.store.pipe(select(appStore.getPrincipal))),
    switchMap(async ([action, user]) => {

      // Reset appPercyConfig
      _.keys(appPercyConfig).forEach(key => delete appPercyConfig[key]);

      const applicationName = action.payload.applicationName;
      try {
        const result = await this.fileManagementService.getEnvironments(user, applicationName);

        _.assign(appPercyConfig, result.appPercyConfig);

        return new PageLoadSuccess(result);
      } catch (error) {
        return new PageLoadFailure(error);
      }
    })
  );

  // load environment failure effect
  @Effect()
  pageLoadFailure$ = this.actions$.pipe(
    ofType<PageLoadFailure>(EditorActionTypes.PageLoadFailure),
    map((action) => new APIError(action.payload))
  );
}

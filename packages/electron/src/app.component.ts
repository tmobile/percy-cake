import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material';
import { Store } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';

import { electronApi } from 'config';
import { UtilService } from 'services/util.service';
import * as appStore from 'store';
import * as AuthActions from 'store/actions/auth.actions';

import { PreferencesComponent } from './components/preferences/preferences.component';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class ElectronAppComponent implements OnInit {

  /**
   * constructs the component.
   * @param router the router service
   * @param dialog the dialog service
   * @param utilService the util service
   */
  constructor(
    private router: Router,
    private dialog: MatDialog,
    private utilService: UtilService,
    private store: Store<appStore.AppState>) {
  }

  /**
   * Wrap the callbacks in angular zone.
   * @param callbacks The callbacks
   */
  private wrapInZone(callbacks) {
    Object.keys(callbacks).forEach(key => {
      const prev = callbacks[key];
      callbacks[key] = this.utilService.wrapInZone(prev);
    });
    return callbacks;
  }

  /**
   * initializes the component.
   */
  ngOnInit() {
    if (electronApi) {
      const openMode = window['openMode'] = new BehaviorSubject('');

      // Register the renderer ipc events listerner
      electronApi.registerRendererListeners(this.wrapInZone({
        openFolder: (folder: string) => {
          this.router.navigate(['/electron', folder]);
        },
        openRepo: () => {
          this.store.dispatch(new AuthActions.Logout());
          openMode.next('remote');
        },
        showPreferences: () => {
          this.dialog.open(PreferencesComponent).afterClosed().subscribe((res) => {
            if (res) {
              window.location.reload();
            }
          });
        }
      }));
    }
  }
}

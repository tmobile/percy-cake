import { Component, OnInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';

import { electronApi } from 'config';
import { BehaviorSubject } from 'rxjs';
import { MatDialog } from '@angular/material';
import { PreferencesComponent } from 'components/preferences/preferences.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {

  /**
   * constructs the component.
   * @param router the router service
   * @param dialog the dialog service
   * @param ngZone the ngZone service
   */
  constructor(
    private router: Router,
    private dialog: MatDialog,
    private ngZone: NgZone) {
  }

  /**
   * Wrap the callbacks in angular zone.
   * @param callbacks The callbacks
   */
  private wrapInZone(callbacks) {
    Object.keys(callbacks).forEach(key => {
      const prev = callbacks[key];
      callbacks[key] = (...args) => {
        this.ngZone.run(() => {
          prev(...args);
        });
      };
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
          this.router.navigate(['/login']);
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

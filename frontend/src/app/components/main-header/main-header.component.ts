import { Component } from '@angular/core';
import { Store } from '@ngrx/store';

import * as appStore from 'store';
import * as AuthActions from 'store/actions/auth.actions';

@Component({
  selector: 'app-main-header',
  templateUrl: './main-header.component.html',
  styleUrls: ['./main-header.component.scss']
})
export class MainHeaderComponent {

  constructor(private store: Store<appStore.AppState>) { }

  /*
   * logout
   */
  logout() {
    this.store.dispatch(new AuthActions.Logout());
  }
}

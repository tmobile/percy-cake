import { OnInit, Component } from '@angular/core';
import { Store } from '@ngrx/store';

import * as appStore from '../../store';
import { LoadFiles, ListApplications, Initialized } from '../../store/actions/backend.actions';

@Component({
  selector: 'app-entry',
  templateUrl: './app-entry.component.html',
  styleUrls: ['./app-entry.component.scss']
})
export class AppEntryComponent implements OnInit {

  /**
   * initializes the component
   * @param store the app store instance
   */
  constructor(
    private store: Store<appStore.AppState>,
  ) { }

  /**
   * handle component initialization
   */
  ngOnInit() {
    this.store.dispatch(new ListApplications());
    this.store.dispatch(new LoadFiles());
    this.store.dispatch(new Initialized());
  }
}

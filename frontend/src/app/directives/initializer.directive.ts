import { Directive, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { take } from 'rxjs/operators';

import * as appStore from '../store';
import { ListApplications, LoadFiles, Initialized } from '../store/actions/backend.actions';

@Directive({
  selector: '[appInitializer]'
})
export class InitializerDirective implements OnInit {

  constructor(private store: Store<appStore.AppState>) {}

  ngOnInit() {
    this.store.pipe(select(appStore.backendState), take(1)).subscribe(
      (backendState) => {
        if (!backendState.initialized) {

          this.store.dispatch(new ListApplications());
          this.store.dispatch(new LoadFiles());
          this.store.dispatch(new Initialized());
        }
      }
    );
  }
}

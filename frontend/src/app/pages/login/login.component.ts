import { Component, OnInit, ViewChild, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { FormControl, Validators } from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material';

import { Store, select } from '@ngrx/store';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, startWith, debounceTime, distinctUntilChanged, switchMap, withLatestFrom, tap } from 'rxjs/operators';

import * as boom from 'boom';
import * as _ from 'lodash';

import * as appStore from 'store';
import * as AuthActions from 'store/actions/auth.actions';
import { MaintenanceService } from 'services/maintenance.service';

const urlFormat = /^(http[s]?:\/\/){0,1}(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/;

/*
  Login page
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  username = new FormControl('', [Validators.required]);
  password = new FormControl('', [Validators.required]);
  repositoryURL = new FormControl('', [Validators.required, Validators.pattern(urlFormat)]);
  branchName = new FormControl('', [Validators.required]);
  loginError: string = null;
  formProcessing = this.store.pipe(select(appStore.getFormProcessing));

  usernameTypeAhead: string[] = [];
  filteredUsernames = new BehaviorSubject<string[]>([]);

  // use to trigger the change in the input from browser auto fill
  @ViewChild('autoTrigger') private autoTrigger: MatAutocompleteTrigger;

  /**
   * initializes the component
   * @param router the router instance
   * @param store the app store instance
   * @param maintenanceService the maintenance service
   * @param _document the document instance
   */
  constructor(
    private store: Store<appStore.AppState>,
    private router: Router,
    private maintenanceService: MaintenanceService,
    @Inject(DOCUMENT) private _document: Document
  ) { }

  /**
   * handle component initialization
   */
  ngOnInit() {
    // if currentURL is login then route depending on whether user is logged-in or not
    this.store.pipe(select(appStore.getLoggedIn)).pipe(
      withLatestFrom(this.store.pipe(select(appStore.getRedirectUrl))),
      tap(([isAuthenticated, redirectUrl]) => {
        if (isAuthenticated) {
          return this.router.navigate([redirectUrl || '/dashboard']);
        }
      })
    ).subscribe();

    this.username.valueChanges
      .pipe(
        startWith(null),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap(value => this._filter(value))
      ).subscribe(this.filteredUsernames);

    this.store.pipe(select(appStore.getDefaultRepo)).pipe(
      tap((repo) => {
        if (repo) {
          this.repositoryURL.setValue(repo.repositoryUrl);
          this.branchName.setValue(repo.branchName);
        }
    })).subscribe();
    this.store.dispatch(new AuthActions.GetDefaultRepo());

    this.store.pipe(select(appStore.getLoginError)).pipe(tap((le) => {
      this.loginError = null;

      if (!le) {
        return;
      }

      const err = boom.boomify(le);

      // Show the error in form field
      if (err.output.statusCode === 401) {
        return this.password.setErrors({invalid: true});
      } else if (err.output.statusCode === 403) {
        return this.repositoryURL.setErrors({forbidden: true});
      } else if (err.message === 'Repository not found') {
        return this.repositoryURL.setErrors({notFound: true});
      } else if (err['code'] === 'ResolveRefError' && _.get(err, 'data.ref') === this.branchName.value) {
        return this.branchName.setErrors({notFound: true});
      }

      this.loginError = 'Login failed';
    })).subscribe();
  }

  /*
   * login if the form is valid
   */
  login() {
    if (this.username.valid && this.password.valid && this.repositoryURL.valid && this.branchName.valid) {
      this.store.dispatch(new AuthActions.Login({
        repositoryUrl: this.repositoryURL.value,
        branchName: this.branchName.value,
        username: this.username.value,
        password: this.password.value
      }));
    }
  }

  /*
   * when user types in an input field remove error messages
   */
  inputChange() {
    this.loginError = null;
  }

  /**
   * handles the input event of input field
   * this is used to support browser auto fill pass the validation
   * otherwise chrome will show required for username when username is
   * filled from browser auto fill
   */
  onInput = (event: KeyboardEvent) => {
    const target = event.currentTarget as HTMLInputElement;

    if (this._document.activeElement !== target) {
      this.autoTrigger._onChange(target.value);
    }
  }

  /**
   * filters the usernames with given prefix
   * @param value the prefix
   */
  private _filter(value: string): Observable<string[]> {
    const filterValue = _.trim(value).toLowerCase();
    // only call API if first character else filter from cache value
    if (filterValue.length === 1) {
      return this.maintenanceService.getUserTypeAhead(filterValue).pipe(
        map((typeAhead: string[]) => {
          this.usernameTypeAhead = typeAhead;
          return this.usernameTypeAhead.filter(option => _.startsWith(option.toLowerCase(), filterValue));
        }));
    } else {
      return of(this.usernameTypeAhead.filter(option => _.startsWith(option.toLowerCase(), filterValue)));
    }
  }
}

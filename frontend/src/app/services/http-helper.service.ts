import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isString, isNil, forEach } from 'lodash';

import { environment } from '../../environments/environment';
import { UtilService } from './util.service';
import { LOGGED_IN_USER_KEY } from '../config/index';

export const API_BASE_URL = environment.api.baseUrl;

/**
 * This service provides the helper method for calling Http endpoints
 */
@Injectable({ providedIn: 'root' })
export class HttpHelperService {

  /**
   * initializes the service
   * @param http the http client instance
   * @param utilService the utility service instance
   */
  constructor(private http: HttpClient, private utilService: UtilService) { }

  /**
   * Performs a request with `get` http method.
   * @param url the url
   * @param options the request options
   */
  get(url: string, options?: any): Observable<any> {
    return this.http
      .get(API_BASE_URL + url, this.requestOptions(options));
  }

  /**
   * Performs a request with `post` http method.
   * @param url the url
   * @param body the body
   * @param options the request options
   */
  post(url: string, body: any, options?: any): Observable<any> {
    return this.http
      .post(API_BASE_URL + url, body, this.requestOptions(options));
  }

  /**
   * Performs a request with `put` http method.
   * @param url the url
   * @param body the body
   * @param options the request options
   */
  put(url: string, body: any, options?: any): Observable<any> {
    return this.http
      .put(API_BASE_URL + url, body, this.requestOptions(options));
  }

  /**
   * Performs a request with `delete` http method.
   * @param url the url
   * @param options the request options
   */
  delete(url: string, options?: any): Observable<any> {
    return this.http.delete(API_BASE_URL + url, this.requestOptions(options));
  }

  /**
   * Configure request options.
   * @param options - request options
   * @param isUpload the flag if the request is made for upload
   */
  private requestOptions(options?: any): any {
    if (options == null) {
      options = {};
    }

    if (options.headers == null) {
      options.headers = new HttpHeaders();
    }

    if (options.params != null) {
      if (!isString(options.params)) {
        forEach(options.params, (value, key) => {
          if (isNil(value) || (isString(value) && value.length === 0)) {
            delete options.params[key];
          }
        });
      }
    }

    const authInfo = this.utilService.getFromStorage(LOGGED_IN_USER_KEY);

    if (authInfo && authInfo.currentUser && authInfo.currentUser.token) {
      options.headers = options.headers.set('Authorization', 'Bearer ' + authInfo.currentUser.token);
    }
    if (!options.headers.has('Content-type')) {
      options.headers = options.headers.set('Content-Type', 'application/json');
    }
    return options;
  }
}

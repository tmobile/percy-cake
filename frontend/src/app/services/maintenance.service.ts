import { Injectable } from '@angular/core';
import { HttpHelperService } from './http-helper.service';
import { Observable } from 'rxjs';

/**
 * This service provides the methods around the maintenance API endpoints
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {

    /**
     * initializes the service
     * @param httpHelperService the http helper service
     */
    constructor(private httpHelperService: HttpHelperService) { }

    /**
     * gets the user type ahead based on prefix
     * @param prefix the prefix
     */
    getUserTypeAhead(prefix: string): Observable<any> {
        return this.httpHelperService.get(`/userTypeAhead?prefix=${prefix}`);
    }

    /**
     * logs the message to the api
     * @param message the message
     */
    logError(message: string): Observable<any> {
        return this.httpHelperService.post('/log', { message });
    }

    /**
     * gets default repo url and branch
     */
    getDefaultRepo(): Observable<any> {
        return this.httpHelperService.get('/defaultRepo');
    }
}

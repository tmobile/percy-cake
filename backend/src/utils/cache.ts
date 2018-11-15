/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This module contains the cache.
 *
 * @author TCSCODER
 * @version 1.0
 */
export default class Cache {

    /**
     * gets the caches for the provided `key`
     * @param key the key to get
     * @returns the cache of key
     */
    public static get(key: string): any {
        return this.cache[key];
    }

    /**
     * sets the value of key
     * @param key the key
     * @param theStatus the status to be saved
     */
    public static set(key: string, theStatus: any): any {
        this.cache[key] = theStatus;
    }

    /**
     * the cache variable
     * @private
     */
    private static cache: any = {};
}

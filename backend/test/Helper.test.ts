/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines tests for helper.
 *
 * @author TCSCODER
 * @version 1.0
 */
import { assert } from 'chai';

import * as helper from '../src/utils/helper';

describe('Helper Tests', () => {
  it('Encrypt/decrypt password', () => {
    const password = 'test password';
    const encrypted = helper.encrypt(password);
    assert.equal(helper.decrypt(encrypted), password);
  });

  it('Convert Git error', () => {
    let error = helper.convertGitError(new Error('remote: Invalid username or password'));
    assert.isTrue(error.output.statusCode === 401);

    error = helper.convertGitError(new Error('remote: Unauthorized'));
    assert.isTrue(error.output.statusCode === 403);

    error = helper.convertGitError(new Error('remote: Forbidden'));
    assert.isTrue(error.output.statusCode === 403);

    error = helper.convertGitError(new Error('remote: Repository not found'));
    assert.isTrue(error.output.statusCode === 404);

    error = helper.convertGitError(new Error('Could not find remote branch'));
    assert.isTrue(error.output.statusCode === 404);

    error = new Error('Network error');
    assert.equal(error, helper.convertGitError(error));
  });

});

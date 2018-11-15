/**
 * Copyright (c) 2018 TopCoder, Inc. All rights reserved.
 */

/**
 * This file defines the mock of SimpleGit.
 *
 * @author TCSCODER
 * @version 1.0
 */
import * as simpleGit from 'simple-git/promise';
import * as TypeMoq from 'typemoq';

import GitWrapper from '../src/services/GitWrapper';

// Create mock
const MockGit: TypeMoq.IMock<simpleGit.SimpleGit> = TypeMoq.Mock.ofInstance(simpleGit(), TypeMoq.MockBehavior.Loose);

// Set mock object to wrapper
GitWrapper.Git = () => MockGit.object;

export default MockGit;

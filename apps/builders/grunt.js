/**
=========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
===========================================================================
*/
const { pathExistsSync } = require("fs-extra");
const path = require("path");

module.exports = function (grunt) {

    function resolvePath(dir, file, check = true) {
        const resolved = path.resolve(dir, file);
        if (check && !pathExistsSync(resolved)) {
            grunt.fail.fatal(`Path does not exist: ${resolved}`);
        }
        return resolved;
    }

    function getPaths(app) {
        const paths = {};
        const isBuildingApp = grunt.cli.tasks.includes(`Build:${app}`);
    
        const dist = resolvePath(__dirname, '../' + app + '/dist' + (app === 'webapp' ? '/build' : ''), isBuildingApp);
    
        paths.index = resolvePath(dist, 'index.html', isBuildingApp);
        paths.css = resolvePath(dist, 'styles.css', isBuildingApp);

        paths.main = resolvePath(dist, 'main.js', isBuildingApp);
        paths.polyfill = resolvePath(dist, 'polyfills.js', isBuildingApp);
        paths.polyfillES5 = resolvePath(dist, 'polyfills-es5.js', isBuildingApp);
        paths.scripts = resolvePath(dist, 'scripts.js', isBuildingApp && app !== 'vscode');
        paths.percy = resolvePath(dist, 'percy.bundle.min.js', false);
    
        paths.percyDistConf = resolvePath(dist, 'percy.conf.json', false);
        paths.percyProdConf = resolvePath(__dirname, '../' + app + '/src/percy.conf.prod.json', isBuildingApp && app !== 'vscode');
    
        return paths;
    }

    const webappPaths = getPaths('webapp');
    const vscodePaths = getPaths('vscode');
    const electronPaths = getPaths('electron');

    grunt.loadNpmTasks('grunt-string-replace');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.initConfig({
        "string-replace": {
            webapp: {
                files: [{
                    dest: webappPaths.index,
                    src: './index.html',
                }],
                options: {
                    replacements: [
                        {
                            pattern: '<!--inject_css-->',
                            replacement: '<style type="text/css"><%= grunt.file.read("' + webappPaths.css + '") %></style>'
                        },
                        {
                            pattern: '<!--inject_js-->',
                            replacement: '<script src="polyfills-es5.js" nomodule defer></script><script src="percy.bundle.min.js" defer></script>'
                        }
                    ]
                }
            },
            electron: {
                files: [{
                    dest: electronPaths.index,
                    src: './index.html',
                }],
                options: {
                    replacements: [
                        {
                            pattern: '<!--inject_css-->',
                            replacement: '<style type="text/css"><%= grunt.file.read("' + electronPaths.css + '") %></style>'
                        },
                        {
                            pattern: '<!--inject_js-->',
                            replacement: '<script src="percy.bundle.min.js" defer></script>'
                        }
                    ]
                }
            }
        },
        concat: {
            options: {
                separator: ';',
            },
            webapp: {
                src: [webappPaths.polyfill, webappPaths.scripts, webappPaths.main],
                dest: webappPaths.percy,
            },
            electron: {
                src: [electronPaths.polyfill, electronPaths.scripts, electronPaths.main],
                dest: electronPaths.percy,
            },
            vscode: {
                src: [vscodePaths.polyfill, vscodePaths.main],
                dest: vscodePaths.percy,
            },
        },
        clean: {
            options: {
                force: true
            },
            webapp: [webappPaths.css, webappPaths.polyfill, webappPaths.scripts, webappPaths.main],
            electron: [electronPaths.css, electronPaths.polyfill, electronPaths.polyfillES5, electronPaths.scripts, electronPaths.main],
            vscode: [vscodePaths.index, vscodePaths.polyfill, vscodePaths.polyfillES5, vscodePaths.main]
        },
        copy: {
            webapp: {
                src: webappPaths.percyProdConf,
                dest: webappPaths.percyDistConf,
            },
            electron: {
                src: electronPaths.percyProdConf,
                dest: electronPaths.percyDistConf,
            },
        }
    });

    grunt.registerTask('build:vscode', ['concat:vscode', 'clean:vscode']);
    grunt.registerTask('build:webapp', ['string-replace:webapp', 'concat:webapp', 'clean:webapp', 'copy:webapp']);
    grunt.registerTask('build:electron', ['string-replace:electron', 'concat:electron', 'clean:electron', 'copy:electron']);
};

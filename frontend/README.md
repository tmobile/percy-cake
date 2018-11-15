# ConfigEditorApp

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 6.2.1.

## Development server

Run under `config-editor-app`
```
    npm i
    ng serve --o
```
Application will build and start at localhost:4200

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).


## Known Issues

- backend have issue while converting YAML to JSON.
    e.g. if value is string with number i.e. "55" then backend will save it as 55
    similarly while returning if value is boolean then it will return as string "true"
    same applies to empty objects

    http://apps.topcoder.com/forums/?module=Thread&threadID=924067&start=0

- test are not done as it is optional
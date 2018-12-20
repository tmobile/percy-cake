# Percival Editor

## Overview

"Configuration as code" is a technique to store environmental variables, feature flags, and other configuration items in an SCM the same way the code is stored. When the code is deployed, the CI process generates the specific configuration for the proper environment from the config SCM. Then the CD process deploys it to the appropriate hosts alongside the new code. The significant advantage of this approach is that configuration changes are tracked over time which is critical to support.

Percival Editor is a configuration tool that allows developers and DevOps a standard and hierarchical approach and intuitive form like User Interface for managing and maintaining complex configuration environments. The configuration files created by this tool will be used in DevOps pipeline to generate final configuration for deployment to various environments.

The editor allows the user to manage (list, create, edit or delete) YAML configuration files from a git repository in the browser directly. 
and it's a pure static web page, that requires no back-end. But a proxy may be needed for it to access the git repository successfully.

The git repository to be managed by this editor must follow the mono directory structure as below:
```
apps/
  +- .percyrc
  +- app1/
  |    +- client.config.yaml
  |    +- server.config.yaml
  |    +- feature.toggles.yaml
  |    +- environments.yaml
  |    +- hydrate.js
  |    +- readme.md
  |    +- .percyrc
  +- app2/
  |    +- client.config.yaml
  |    ...
  ...
libs/
  +- hydration.libs.hjs
  +- readme.md
readme.md
```

It must have an `apps` directory (the directory name is configurable), with each sub-directory representing an application. The editor will load all applications together with all the YAML files inside each application (non-YAML files will be ignored). 

The `hydrate.js` script here is used in the CI process to *hydrate* the YAML files in the repository to generate environment specific YAML files, which is then used for deployment to various environments. The editor provides a  feature to allow the user to preview the generated environment specific YAML file. 

In each application folder, all YAML files must follow the format as below:
```yaml
default: !!map


environments: !!map

```

The `default` node contains the default configuration properties for the application, and the `environments` node contains multiple environment nodes, with each environment node containing environment-specific configuration properties. 

The environment nodes inherit the `default` node, and the user can add properties to override the default values in the `default` node.

Here is an example of a YAML file, and you can notice the `environments` node contains `prod`, `dev` and `qa` environment nodes. 
```yaml
default: !!map
  server.host: !!int 1  # TMO server url
  mytmo.server.host: !!str "https://default.my.t-mobile.com"  # MYTMO server url
  middlewareapipath: !!str "_{$middlewareurl}_/mw/api/path"
  $middlewareurl: !!str "https://default.middleware.t-mobile.com"  # Backend MW url
  $dcphost: !!str "https://default.api.t-mobile.com"
  $api-path: !!str "/path/to/api"
  apihost: !!str "http://tmonext-gen.com_{$api-path}_"
  dcpendpoints: !!map
    dcpcart: !!str "_{$dcphost}_/api/cart"
    dcpupdate: !!str "_{$dcphost}_/api/update"
    dcprefund: !!str "_{$dcphost}_/api/refund"
environments: !!map
  prod: !!map
    $middlewareurl: !!str "https://e3.my.t-mobile.com"  # Production middleware endpoint
    apihost: !!str "http://t-mobile.com_{$api-path}_"
    $dcphost: !!str "http://prod.dcp.com"
    dcpendpoints: !!map
      dcpcart: !!str "_{$dcphost}_/api/v2/cart"
  dev: !!map
    $middlewareurl: !!str "https://tmo.tugs.dev.com"  # Production middleware endpoint
    apihost: !!str "http://t-mobile.com_{$api-path}_"
    newProperty: !!str "hello"
  qa: !!map
    $middlewareurl: !!str "https://tmo.tugs.qat.com"  # Production middleware endpoint
    apihost: !!str "http://t-mobile.com_{$api-path}_"
```

Each application will have a special YAML file called `environments.yaml` (the file name is configurable), which defines all the environments supported by the application. So in the editor, when editing the other YAML files, you can simply select the environments pre-defined in this file. 


## Usage

Log in with your username / password of your git account, the URL and branch of your configuration repository. 
The editor dashboard will load the YAML files in each application folder from your repository. 
Then you can select any file to edit, delete a file or add a new file to the application. 

On the add / edit page, the `SAVE AS DRAFT` button will only save your changes locally, the changes are only committed and pushed to the repository when you click `COMMIT` button. 
You can also save multiple files as draft, and use the 'COMMIT CHANGES' button on the dashboard page to commit and push changes altogether. 

The environment nodes have a `View Compiled YAML` option, which will generate a preview of environment specific YAML file that user uses in application deployment. It does the similar thing as the `hydrate.js` script mentioned above. In this view, all inheritances and variables will be resolved. 

Here is a brief [video](https://www.youtube.com/watch?v=Ealtb91SUFM&feature=youtu.be) to demonstrate the features. 


## Feature List

- Load YAML files from a mono structured repository
- Display YAML file in an intuitive structured tree view
- Support YAML property with object, bool, string,  number types, and an array of simple types
- Create a new YAML file
- Edit an existing YAML file
- Delete an existing YAML file
- Save draft changes locally in the browser
- Commit changes to the repository
- Resolve conflicts when committing changes
- Define variables at the top-level, and use the variables anywhere in the YAML file
- The environment node has a special `inherits` property, it can be used to inherit from another environment node. Note that all environment nodes inherit from the default node by default. 
- View the compiled YAML of the environment node, in this view, the inherits and variables will be resolved. 


## How it works

The editor is created with Angular 7, and [Material components](https://material.angular.io/components/categories) are used extensively to build UI interface. [@ngrx](http://ngrx.github.io/) is used for reactive state management of the UI.

[isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) is used to clone remote git repo and commit changes. Repo files and draft changes are all saved in the browser by using [Filer](https://filer.js.org/) which simulates a file system (with IndexedDB as underlying storage).

If this web app is hosted in a different domain than the git server domain, a [CORS proxy](https://github.com/isomorphic-git/isomorphic-git#cors-support) server need to be set up to allow cross sites requests.



## Known Issues

The browser filesystem is built on top of IndexedDB, the performance and stability are limited by IndexedDB and thus is not as good as a real filesystem.

To relieve the impact, we have adopted several ways to reduce file I/O:

- Shallow clone with 1 depth
- Fetch remote commits with 1 depth
- After clone/fetch, we never check out the files to working copy, just saving the git packed objects/files and will directly use the packed objects/files afterwards.
- We use an in-memory cache layer in front of the IndexedDB. Due to the fact that read file operations are much more frequent than write file operations, the cache layer improves the user experience a lot. For write operations, the cache uses write-through strategy to ensure data updates are safely stored on IndexedDB.



## Configuration

There are 3 configuration files:

- [src/percy.conf.json](src/percy.conf.json): configuration used in development
- [src/percy.conf.test.json](src/percy.conf.test.json): configuration used in Karma test
- [src/percy.conf.prod.json](src/percy.conf.prod.json): for production configuration, it will be copied to `dist/build/percy.conf.json` in the production build

| Variable                 | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| corsProxy                | The cors proxy for isomorphic-git                            |
| defaultBranchName        | Default branch name shown on login page                      |
| defaultRepositoryUrl     | Default repository url shown on login page                   |
| lockedBranches           | Locked branches, you cannot enter these branches on login page   |
| storeName                | The browser indexeddb store name                             |
| reposFolder              | The browserfs folder to clone repos into                     |
| draftFolder              | The browserfs folder to store draft files                    |
| metaFolder               | The browserfs folder contains metadata file                  |
| repoMetadataVersion      | The repo metdata version (in case the structrure of repo metadata changes, update this version) |
| loggedInUsersMetaFile    | The file name which contains logged in user names            |
| yamlAppsFolder           | The folder name which contains apps' yaml config             |
| environmentsFile         | The environments file name (JUST file name)                   |
| pullTimeout              | The git pull timeout, in which case will switch to clone         |
| loginSessionTimeout      | The login session timeout, like "1m", "2.5 hrs", "2 days". Default to 30m. |
| encryptKey               | The key used to encrypt security information like password   |
| encryptSalt              | The salt used to encrypt security information like password  |
| variablePrefix           | The YAML variable substitute prefix                          |
| variableSuffix           | The YAML variable substitute suffix                          |


The git repository can contain optional `.percyrc` files, which provide repository-specific or application-specific configuration. The following properties are supported now:

| Property                 | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| variablePrefix           | The YAML variable substitute prefix                          |
| variableSuffix           | The YAML variable substitute suffix                          |

If it's in the `apps` folder, the configuration applies to all applications, and if it's in the specific application folder, it only applies to the corresponding application. When provided, the default properties from the `percy.conf.json` will be overridden. 

Here is an example of `.percyrc` file:
```json
{
  "variablePrefix": "{{",
  "variableSuffix": "}}"
}
```

## Development

Prerequisite

- Node.js 10
- Npm 6

```bash
# Install dependencies
npm i

# Lint code
npm run lint

# Run unit tests
npm test

# Start development server at http://localhost:4200
npm start
```



## Run from Docker

Prerequisite

- Docker
- Docker Compose



Build app (which will build in production mode), the static assets are built under `dist/build`:

```bash
./docker/build.sh

# After build, 3 files will be generated in 'dist/build':
# index.html
# percy.bundle.min.js
# percy.conf.json (which is a copy of src/percy.conf.prod.json)
```



Run docker compose:

```bash
docker-compose -f ./docker/docker-compose.yml up --build
```



In this step supports config the nginx port, you can refer to [docker/docker-compose.yml](docker/docker-compose.yml)  :

| Environment | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| NGINX_PORT  | The nginx server port. The nginx will serve both the static assets in `dist` and the isomorphic-git proxy. |



Assume `NGINX_PORT` is configured as 8080, then you can visit http://localhost:8080



## How VSCode Extension works

In general, the VSCode extension of Percy editor is also an Angular app running in [VSCode webview](https://code.visualstudio.com/docs/extensions/webview).

1. Module and Component are core concepts of angular, so we abstract the common ui part of editor component, making it reusable in both webaap and VSCode extension app.
2. The vscode extension app does not need some functionalities (like route, browser fs, localstorage, pages components, most ngrx effects. These functionalities may not even be supported in vscode webview). So we have done necessary code refactor to make the vscode extension app can get rid of those unneeded and only import needed dependency modules.
3. So as point 2 implied, the webapp and vscode extension app use different dependency modules, how to build and bundle them separately? Fortunately “ng build” command allows to pass main entrypoint as “--main” parameter, this makes it possible to build/bundle multiple apps differently:
   - Webapp main entrypoint: [src/webapp/webapp.ts](src/webapp/webapp.ts)  =>  [src/webapp/app.module.ts](src/webapp/app.module.ts)
   - VSCode main entrypoint: [src/vscode/vsapp.ts](src/vscode/vsapp.ts)  =>  [src/vscode/vsapp.module.ts](src/vscode/vsapp.module.ts)

4. The communication between vscode extension and its webview content is done by the official way using message post.

## Run VSCode Extension

```bash
# At first build & package the vscode extenstion
./vscode/build.sh

# The extension will be packaged at ./vscode/percy-editor-extension-0.0.0.vsix
```



After build, you can either:

- Open the project in VSCode, Click "Debug -> Start Debugging", a new VSCode window will be opened with the extension activated.
- Or install the extension in VScode: `code --install-extension ./vscode/percy-editor-extension-0.0.0.vsix`
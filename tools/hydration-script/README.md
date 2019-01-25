## Percival Hydration and JSON Comparison Command Line Utilities


## Prerequisites

- Node.js 10.15.x
- Npm 6

## Installation

```
npm install percy-hydration
```

Or install commands globally
```
npm install -g percy-hydration
```

## Usage In Command Line

### compare-json

Script for comparing two json files and outputting their differences to stdout

`compare-json <path/to/file.json> <path/to/file.json>`

```bash
# Example
compare-json test/data/.percyrc test/data/modified.percyrc

# To generate HTML report
compare-json test/data/.percyrc test/data/modified.percyrc -- --out ./test/data/out/diff.html
```

### hydrate

Script for processing YAML configuration files and converting it to environment specific JSON configuration

`hydrate < --root | --app | --file > <path/to/input> --out <path/to/output>`
It provides three options
- `--root` `-r` for processing all apps in a root directory
- `--app` `-a` for processing a single app directory
- `--file` `-f` for processing a single file
You should specify one of these three options.

```bash
# Examples

# Process all apps
hydrate -r test/data/apps --out test/data/out/dist

# Process single app
hydrate -a test/data/apps/shop --out test/data/out/dist/shop

# Process single file
hydrate -f test/data/apps/shop/app.config.yaml --out test/data/out/dist/shop
```

**_NOTE:_** if you are not installing globally, used the scripts like below instead:
```
node_modules/.bin/hydrate -r test/data/apps --out test/data/out/dist
node_modules/.bin/compare-json test/data/.percyrc test/data/modified.percyrc --out ./test/data/out/diff.html
```

## Configuration

Main configuration file can be found at `config/default.js`

| Variable                     | Description                                                                                                                                                |
|------------------------------|-------------------------------------------------------------------|
| LOG_LEVEL                    |                                                                   |
| ENVIRONMENT_FILE_NAME        | Name of the environment file (default value: `environments.yaml`) |
| PERCY_CONFIG_FILE_NAME       | Name of the percy configuration file (default value: `.percyrc`)  |                                                                                               |
| DEFAULT_VARIABLE_PREFIX      | The YAML variable substitute prefix (default value: `_{`)         |
| DEFAULT_VARIABLE_SUFFIX      | The YAML variable substitute suffix (default value: `}_`)         |
| DEFAULT_VARIABLE_NAME_PREFIX | The YAML variable name prefix (default value: `$`)                |

The app folder can contain optional `.percyrc` files, which provide repository-specific or application-specific configuration. The following properties are supported now:

| Property           | Description                         |
|--------------------|-------------------------------------|
| variablePrefix     | The YAML variable substitute prefix |
| variableSuffix     | The YAML variable substitute suffix |
| variableNamePrefix | The YAML variable name prefix       |

If it's in the `apps` folder, the configuration applies to all applications, and if it's in the specific application folder, it only applies to the corresponding application. When provided, the default properties from the `config/default.js` will be overridden.

Here is an example of `.percyrc` file:
```json
{
  "variablePrefix": "{{",
  "variableSuffix": "}}",
  "variableNamePrefix": "_"
}
```

## Installation

```bash
# Install dependencies
npm i

# Lint code
npm run lint

# Run unit tests with coverage
npm test

```

## Usage inside the lib

### compare-json

Script for comparing two json files and outputting their differences to stdout

`npm run compare-json <path/to/file.json> <path/to/file.json>`

```bash
# Example
npm run compare-json test/data/.percyrc test/data/modified.percyrc

# To generate HTML report
npm run compare-json test/data/.percyrc test/data/modified.percyrc -- --out ./test/data/out/diff.html
```

### hydrate

Script for processing YAML configuration files and converting it to environment specific JSON configuration

`npm run hydrate -- < --root | --app | --file > <path/to/input> --out <path/to/output>`
It provides three options 
- `--root` `-r` for processing all apps in a root directory
- `--app` `-a` for processing a single app directory
- `--file` `-f` for processing a single file
You should specify one of these three options.

```bash
# Examples

# Process all apps
npm run hydrate -- -r test/data/apps --out test/data/out/dist

# Process single app
npm run hydrate -- -a test/data/apps/shop --out test/data/out/dist/shop

# Process single file
npm run hydrate -- -f test/data/apps/shop/app.config.yaml --out test/data/out/dist/shop
```


## Run with compiled JS (better performance)

You can compiled the ts files to js, by running:
```
tsc
```

then run the js files using these script:
```
# hydrate Examples

# Process all apps
npm run hydrate.js -- -r test/data/apps --out test/data/out/dist

# Process single app
npm run hydrate.js -- -a test/data/apps/shop --out test/data/out/dist/shop

# Process single file
npm run hydrate.js -- -f test/data/apps/shop/app.config.yaml --out test/data/out/dist/shop

# compare-json Example
npm run compare-json.js test/data/.percyrc test/data/modified.percyrc
```

## Documentation
Documentations are auto generated and can be accessed from `docs` folder. 
In order to generate docs again you can call `npm run docs` command.


## Publish
To publish this library, run:
```
tsc
npm publish
```
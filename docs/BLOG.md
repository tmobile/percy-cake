# Percy

Percy is a configuration as code editor, it is not a configuration distribution system like Spring Cloud Configuration Server.

Percy facilitates editing configuration files in a terse (de-hydrated) format that is intended to simplify maintenance of external configuration files of an app or service across multiple deployed environments. The Percy project includes a set of validation and hydration scripts that will expand the de-hydrated ( DRY) configuration files into a set of JSON files, one for every deployment environment. You will still need a mechanism to publish/distribute those config files to your running application/service.

## The Problem:

While working on one of our projects I saw a great deal of duplication in our application configuration files. Not only did we have duplication across a single environment configuration (base urls) but we had the same duplication across the 21 different environments — often only the base urls would change.

```
"url": {
	"mostPopularDevices": 	"https://pd01.api.t-mobile.com/raptor/v1/search-promote/?type=browse&",
	"productBrowseDetailsLive": 	"https://pd01.api.t-mobile.com/raptor/v1/search-promote/?type=browse&pt=Device&ps=Handset",
	"accessoryBrowseDetailsLive": "https://pd01.api.t-mobile.com/raptor/v1/search-promote/?type=browse&pt=Accessory",
	"accessories": 	"https://pd01.api.t-mobile.com/raptor/v1/search-promote/?type=browse&pt=Accessory&o=",
	"compatibleAccessory": 	"https://pd01.api.t-mobile.com/raptor/v1/search-promote/?type=browse&pt=Accessory&facets=true",
	"authorization": 	"https://pd01.api.t-mobile.com/raptor/v1/oauth/v1/access",
	"updateProfile": 	"https://pd01.api.t-mobile.com/raptor/v1/update-profile",
	"ShippingOrderFees": 	"https://pd01.api.t-mobile.com/raptor/v1/order/fees",
	"simKitDetails": 	"https://pd01.api.t-mobile.com/raptor/v1/productDetails/i-739C46ADBDEE4AE9ADE7BF05D984EAE1",
	"shippingOptionsUrl": 	"https://pd01.api.t-mobile.com/raptor/v1/shipping-option/",

	"creditCardInfo": 	"https://pd01.api.t-mobile.com/creditcards/orders",

	"checkoutSetAddress": 	"https://pd01.api.t-mobile.com/v1/orders/{{orderID}}/address",
	"creditcheckUrl": 	"https://pd01.api.t-mobile.com/v1/orders/creditcheck/",
	"creditcardUrl": 	“https://pd01.api.t-mobile.com/v1/orders/creditcards/",

	"getProfile": 	"https://pd01.api.t-mobile.com/v1/profile",
	"authorableCarousel": 	"https://pd01.api.t-mobile.com/v1/products",

	"getDefaultCart": 	"https://pd01.api.t-mobile.com/v1/carts",
	"removeAccessoryFromCart": 	"https://pd01.api.t-mobile.com/v1/carts/",
	"addAccessoryToCart": 	“https://pd01.api.t-mobile.com/v1/carts/",

   "storeLocator": {
	   "search": 	"kkcdrrnxwk.execute-api.us-west-2.amazonaws.com/dev/prod/getStoresByCoordinates",
	   "stateSearch": 	"kcdrrnxwk.execute-api.us-west-2.amazonaws.com/prod/getStoresInState",
	   "citySearch": 	"kcdrrnxwk.execute-api.us-west-2.amazonaws.com/prod/getStoresInCity",
	   "storeSearch": 	"kcdrrnxwk.execute-api.us-west-2.amazonaws.com/prod/getStoreByName",
	   "getInLineReasons": 	“kcdrrnxwk.execute-api.us-west-2.amazonaws.com/dev/prod/getReasons",

	   "addCustomerV2": 	"https://api.t-mobile.com/add-customer/v1/addCustomer",
	   "getLeadInfo": 	"https://api.t-mobile.com/customer-interaction/v1/get-lead?leadId={{leadId}}",
     ...
```

This became a problem when we started creating more lower environments for testing and such. As the list of snowflake environments grew so did the effort to maintain all the proper configurations. If you needed to add a new configuration property you would have to add a copy to every environment specific configuration file. If you needed to change or add a property you would have to duplicate it in all environments, and possibly have different values in different environments. These permutations of configuration property settings made management of the various application deployment configurations fraught with human error.

I tried to solve this problem by creating a hierarchical format to dry the config so that I could change a value in one place and have it apply across the app.

```
    "product": {
      "stage": "http://stage.sp10050e1e.guided.ss-omtrdc.net",
      "host": "https://pd01.api.t-mobile.com/raptor/v1",
      "browse": {
        "service": "/search-promote/",
        "parameters": {
          "phone": "?type=browse&ps=handset",
          "accessory": "?type=browse&pt=accessory",
          "internet-device": "?type=browse&ps=wearable|tablet"
        },
     }
```

This required the application to have the smarts to ‘compile’ these objects into complete urls.

```
  getPhoneCatalogUrl = config.urls.product.host +
                       config.urls.product.browse.service +
	                     config.urls.productbrowse.parameters.phone;
```

// https://pd01.api.t-mobile.com/raptor/v1/search-promote/?type=browse&ps=handset/search-promote/?type=browse&ps=handset

## The solution:

Percy started out as an attempt to solve this problem with a standard format that would allow me to condense the 4 or 5 configuration files duplicated across dozens of environments and combine them into a single, dry collection of properties that would be easy to update across all environments including specializations for individual environments.

Another feature was to find a way that we could enable non-developer participants ( ops, web producers, managers etc) to modify these configuration files safely.

I settled on the YAML format due to its support for comments, property types (for schema validation) as well as anchors and aliases. Having comments in a configuration file is very valuable as it allows developers to leave notes about individual properties, what they are for, when they should be enabled or removed (feature toggles) etc. Property types allow us to apply rules within our tools to validate proper config structure and content.

While YAML turned out to be a great format for editing and storing the configurations it is a terrible format for transmission of the configs as it is a space delimited language, hence it cannot be minimized. Thus, we needed a tool that could “hydrate” these “dry” configuration files into a format that is optimized for http transport layer. In addition, we needed a form based tool that would enable anyone to edit these files safely. Even seasoned developers can mess up a yam file with an extra space, or a missing space. This has caused me countless hours of frustration scrubbing through a file trying to find the missing space.

With Percy I was able to take 5 configuration files, like the one shown above, across 21 different environments for a total of 105 files, 1 copy for every deployed environment- each with only slight variations - all having a combined total of 980 KB of JSON, and de-hydrate them down to only 5 files with combined 56KB of dehydrated (DRY) yaml properties:

```
default: !!map
  _apiHost: !!str 	"pd01.api.t-mobile.com"
  _storeLocatorAPIHost: !!str 	"pd03.api.t-mobile.com"
  _storeLocatorAWSAPIHost: !!str 	"kkcdrrnxwk.execute-api.us-west-2.amazonaws.com/dev"

  url: !!map
    mostPopularDevices: !!str 	"https://${_apiHost}/raptor/v1/search-promote/?type=browse&"
    productBrowseDetailsLive: !!str	"https://${_apiHost}/raptor/v1/search-promote/?type=browse&pt=Device&ps=Handset"
    accessoryBrowseDetailsLive: !!str	"https://${_apiHost}/raptor/v1/search-promote/?type=browse&pt=Accessory"
    accessories: !!str	"https://${_apiHost}/raptor/v1/search-promote/?type=browse&pt=Accessory&o="
    compatibleAccessory: !!str	"https://${_apiHost}/raptor/v1/search-promote/?type=browse&pt=Accessory&facets=true"
    authorization: !!str	“https://${_apiHost}/raptor/v1/oauth/v1/access”
	  updateProfile: !!str	“https://${_apiHost}/raptor/v1/update-profile",
	  ShippingOrderFees: !!str	“https://${_apiHost}/raptor/v1/order/fees",
    simKitDetails: !!str	"https://${_apiHost}/raptor/v1/productDetails/i-739C46ADBDEE4AE9ADE7BF05D984EAE1"
    shippingOptionsUrl: !!str	“https://${_apiHost}/raptor/v1/shipping-option/"

    creditCardInfo: !!str	“https://${_apiHost}/creditcards/orders"

    checkoutSetAddress: !!str	"https://${_apiHost}/v1/orders/{{orderID}}/address"
  	creditcheckUrl: !!str	"https://${_apiHost}/v1/orders/creditcheck/"
    creditcardUrl: !!str	"https://${_apiHost}/v1/orders/creditcards/"

    getProfile: !!str	“https://${_apiHost}/v1/profile"
	  authorableCarousel: !!str	"https://${_apiHost}/v1/products"

    getDefaultCart: !!str	"https://${_apiHost}/v1/carts"
    removeAccessoryFromCart: !!str	"https://${_apiHost}/v1/carts/"
    addAccessoryToCart: !!str	"https://${_apiHost}/v1/carts/"

	storeLocator: !!map
		search: !!str 	"https://${_storeLocatorAWSAPIHost}/getStoresByCoordinates"
		stateSearch: !!str	"https://${_storeLocatorAWSAPIHost}/getStoresInState"
		citySearch: !!str	"https://${_storeLocatorAWSAPIHost}/getStoresInCity"
		storeSearch: !!str	"https://${_storeLocatorAWSAPIHost}/getStoreByName"
		getInLineReasons: !!str	"https://${_storeLocatorAWSAPIHost}/getReasons"
		addCustomerV2: !!str	"https://${_storeLocatorAPIHost}/add-customer/v1/addCustomer"
		getLeadInfo: !!str	"https://${_storeLocatorAPIHost}/customer-interaction/v1/get-lead?leadId={{leadId}}"
  ...
```

There is still duplication in this file but it uses variable substitution, so I can edit the value of \_apiHost in one location at the top of the file to modify every reference.

Then to modify specific attributes for various deployed envirnments we append an `environments` map with sub properties for every environment that wants to change the default settings.

```
environments: !!map

  dailydev: !!map
    _storeLocatorAPIHost: "pd03.api.t-mobile.com"

  demo: !!map
    _apiHost: !!str "pd02.api.t-mobile.com"
    _storeLocatorAPIHost: !!str "pd03.api.t-mobile.com"

  devprd: !!map
    _storeLocatorAWSAPIHost: !!str "md14ltwri9.execute-api.us-west-2.amazonaws.com/dev"
    _apiHost: !!str "qat03-pd.api.t-mobile.com"

  local: !!map
    _apiHost: !!str "pd02.api.t-mobile.com"
    _storeLocatorAPIHost: !!str "qat03-pd.api.t-mobile.com"

  prod: !!map
    _apiHost: !!str "api.t-mobile.com"
    _storeLocatorAPIHost: !!str "api.t-mobile.com"
    _storeLocatorAWSAPIHost: !!str "onmyj41p3c.execute-api.us-west-2.amazonaws.com/prod"

  qat: !!map
    _apiHost: !!str "api.t-mobile.com"
    _storeLocatorAPIHost: !!str "qat03-pd.api.t-mobile.com"

  qatprd: !!map
    _storeLocatorAWSAPIHost: !!str "md14ltwri9.execute-api.us-west-2.amazonaws.com/dev"
    _apiHost: !!str "pd03.api.t-mobile.com"

  stage: !!map
    _apiHost: !!str "api.t-mobile.com"
    _storeLocatorAPIHost: !!str "api.t-mobile.com"
  ...
```

This allows me to show a simple list of every deployed environment and how each is different from the default configuration, instead of copying the entire file and modifying values throughout the file to match the new deployed environment.

## Percy Project

The Percy project comes in 2 parts:

    -	*Configuration Editor*
    -	*Hydration Tools*

The editor can be deployed one of 4 ways, all from the same code base:

    -	Static web assets served from a CDN.
    -	Docker image
    -	Cross platform Desktop Application (Electron)
    -	VSCode Editor extension

The hydration tools, which are node.js based script files, can be deployed as an npm package to include in your projects package.json.

npm install percy-hydration

## Percy Editor:

### editor settings:

The editor uses a settings file called `.percyrc`.

```json
{
  "variablePrefix": "${",
  "variableSuffix": "}",
  "variableNamePrefix": "_"
}
```

This file lists out some simple rules for all configuration files listed within the same directory as the .percyrc file. This settings file will cascade values across hierarchical directory structures.

i.e. mono repo of multiple apps with different styles. The root level can define overall editor settings, but each subfolder defining an application can override those settings with settings of their own.

Currently this file supports settings for variable naming conventions (explained later).
Environment Definitions:

The editor requires an `environments.yaml` file to define the environments that your application or service will be deployed to, the minimum is to have a name key for each deployed environment. These environment names are used by both the Hydration scripts when processing the collection of configuration yaml files, and by the editor when a user wants to define environment specific values.

### Configuration File Format:

All configuration files, including a special file called the `environments.yaml` file, must follow a specific format.

[ picture ]

The _default_ section is where all the allowed property keys are defined. If a property key is not listed in the default section it will not be hydrated to any resulting configuration file. This assures that all configuration files stay in sync with the property keys consumed by the application.

The _environments_ section lists any snowflake environment settings that differ from the default. All environments inherit from the default section just as all environments can change specific default values for just that environment.

### `environments.yaml`

The `environments.yaml` file is a special configuration file and is the only file that can add new values to the environments section. Each property key added to the environments section in this file defines a new deployment environment. Other configuration files refer to this file for a list of what environments are available.

My applications’ `environments.yaml`, shown on the right, states that my application can be deployed to 4 different environments, hence after I hydrate my YAML configuration files I will have 4 sets of JSON configuration files, one for every environment listed in the `environments.yaml`.

[ picture ]

The default section of the environments file lists all the deployment settings for the application in a single environment, the default environment: e.g.

    -	AWS accounts
    -	IP addresses
    -	Namespaces
    -	…

This includes any properties or values that are required to define where are all the assets and services that are deployed in an environment, and how access them. This file can be used by a CI processor to automate deployments and maintenance tasks for any environment.

### Default properties:

The default section of any configuration file, including the `environments.yaml` file, lists all the key:value pairs, in a hierarchical format, that defines the application configurable runtime value as required by your application. This can include API urls, Feature Toggles, Cache settings, even changes to labels and static text displayed within the application.

[ picture ]

To help with normalization of this file, to DRY the contents, we utilize 3 features:

    -	Variable Substitution
    -	Anchors and Aliases
    -	Environment Inheritance

In the image to the above you can see several properties that show variable substitution inside interpolated strings (the orange highlighted strings). In this example we define the \_dcphost up top, then refer to that value in other properties:

    -	`dcpendpoints.dcpcart`
    -	`dcpendpoints.dcpupdate`

Values in the `.percyrc` file determine what characters are used to wrap string interpolated values (when using variable substitution). Above we use `${ … }` to wrap a variable inside a string value. We also prefix the variable name with `_` to identify this as a transient variable (a key that is not to appear by itself in the hydrated file.)

### Environment properties:

Once all the allowed property keys with default values are defined in the default section we need to list how each of our deployed environments differs from the default settings. To do this we add an environment node to our configuration files environments section.

To enforce that configuration files only define environment settings for pre-defined deployment environments the editor uses a drop-down pick list of environment names listed in the `environments.yaml` file. If the environment name does not exist in the `environments.yaml` file then you cannot add any configuration substitutions for that environment name.

The editor follows a set of strict rules including:

• Only environments listed in the `environments.yaml` file can be listed in any other config.yaml file.
• Only properties listed in the config.yaml default node can be substituted (overridden) in any listed environment. You cannot add a different property key to an environment that is not listed in default.
• Properties defined in the default node will include type definition for the property value

1. `string || string array`
2. `boolean || boolean array`
3. `number || number array`
4. `object || object array`
   • Property override values in environment nodes must be of the same type as the default property
   • All environments inherit all values from the default node
   • All environments can inherit from another environment
   • Only one inheritance per environment, other than default.  
   • Chained inheritance is allowed.
   • Inheritance Cycles are not allowed
   • Property keys that are prefixed with the ‘variableNamePrefix’ as defined in the compiled .percyrc will not be included in the final hydrated file, although their values will be interpolated into any variable substitutions defined in the config properties.
   • Property values that are an Array type will have anchors applied to the default array elements.
   • When an environment wants to override the array property they can list any or all of the default properties using the alias form of the corresponding anchor.
   • environments that want to substitute a property within an array element can list the substituted element property names with the substituted values.

```yaml
environments: !!map
  local: !!map
    httpCacheConfig: !!map
      cacheUrls: !!seq
        - *cacheUrls-0
        - !!map
          <<: *cacheUrls-2
          expireInMs: !!int 500
```

# Percy Hydration tools:

The hydration tools enforce the percy formatting rules when transpiring and hydrating the DRY YAML files to a Wet JSON format creating one folder collection of config files for every environment listed in `environments.yaml`.

The hydration tools are easily incorporated into any build environment that has nodejs. They are installed as an npm package : `npm i percy-hydration`

and are executed using one of 2 command line scripts

`hydrate [ -r | -a | -f ] source --out target`

`compare-json file1 file2 [—out reportFilePath]`

The compare-json scripts are a validation that your YAML files are formatted correctly and will output the precise JSON file content your application is expecting to consume.

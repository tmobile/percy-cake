# Publishing to npm repo



To publish this library you must 

1. Make sure local is pushed to origin
1. build the npm package
    ```
    $ lerna run --scope=percy-cake-hydration-tools --stream tsc`
    ``
1. login to the npm registry
    ```
    $ npm login
    ```
1. publish package to registry
    ```
    $ npm publish
    ```


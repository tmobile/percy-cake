Demo:

```bash
# Install dependencies
npm install -g lerna
lerna bootstrap --hoist

# Build percy-cake-hydration-tools
lerna run --scope=percy-cake-hydration-tools --stream tsc

# Run demo
lerna run --scope=percy-cace-hydration-example --stream demo
```


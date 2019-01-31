Demo:

```bash
# Install dependencies
npm install -g lerna
lerna bootstrap --hoist

# Build percy-hydration
lerna run --scope=percy-hydration --stream tsc

# Run demo
lerna run --scope=percy-hydration-example --stream demo
```


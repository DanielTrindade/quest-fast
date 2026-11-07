import { registerHooks } from 'node:module';

// The client imports without extensions, as the bundler allows; Node does not.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const relativeWithoutExtension = specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier);
    return nextResolve(relativeWithoutExtension ? `${specifier}.ts` : specifier, context);
  },
});

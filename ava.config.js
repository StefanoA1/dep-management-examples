export default {
  files: ['test/*.test.*', 'test/**/*.test.*', '!test/helpers/**'],
  cache: false,
  timeout: '3m',
  extensions: ['ts'],
  require: ['ts-node/register/transpile-only']
};

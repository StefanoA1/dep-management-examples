module.exports = {
  env: {
    es6: true,
    node: true,
    browser: false
  },
  overrides: [
    {
      files: ['src/**/*.ts'],
      env: {
        browser: false,
        es6: true,
        node: false
      }
    }
  ],
  plugins: ['@coorpacademy/coorpacademy'],
  extends: [
    'plugin:@coorpacademy/coorpacademy/core',
    'plugin:@coorpacademy/coorpacademy/ava',
    'plugin:@coorpacademy/coorpacademy/es20XX',
    'plugin:@coorpacademy/coorpacademy/lodash-fp',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/typescript',
    'plugin:@coorpacademy/coorpacademy/prettier'
  ],
  parser: '@typescript-eslint/parser',
  settings: {
    'import/ignore': ['node_modules'],
    'import/extensions': ['.js', '.ts', '.tsx'],
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.d.ts']
      }
    },
    node: {
      resolvePaths: ['node_modules/@types'],
      tryExtensions: ['.js', '.json', '.ts', '.d.ts', 'tsx']
    },
    react: {
      version: 'detect'
    }
  },
  rules: {
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@coorpacademy/coorpacademy/no-overwriting-spread': 'off',
    '@coorpacademy/coorpacademy/no-promise-all': 'error',
    'node/no-unsupported-features/es-syntax': ['error', {ignores: ['modules']}],
    '@typescript-eslint/ban-types': 'off',
    'node/file-extension-in-import': [
      'error',
      'always',
      {'.js': 'never', '.ts': 'never', '.json': 'never', '.tsx': 'never', '.jsx': 'never'}
    ],
    'node/no-extraneous-import': [
      'error',
      {
        allowModules: ['aws-lambda']
      }
    ],
    'ava/no-ignored-test-files': ['error', {files: ['**/test/**/*.{js,ts,tsx}']}],
    'fp/no-class': 'off',
    'import/no-extraneous-dependencies': 'off',
    'no-shadow': [
      'error',
      {
        builtinGlobals: true,
        hoist: 'all',
        allow: ['Promise', 'history', 'location', 'find', 'name', 'Notification', 'Animation', 'T']
      }
    ],
    'promise/no-native': 'off',
    'promise/no-callback-in-promise': 'off',
    strict: 'off',
    'import/no-unresolved': ['error', {ignore: ['aws-lambda']}],
    'import/prefer-default-export': 'off',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        mjs: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never'
      }
    ],
    'node/no-missing-import': [
      'error',
      {
        tryExtensions: ['.js', '.json', '.tsx', '.ts', '.d.ts']
      }
    ]
  },
  ignorePatterns: ['*.css', '*.html']
};

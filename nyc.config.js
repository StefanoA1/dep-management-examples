module.exports = {
  extension: ['.ts'],
  'check-coverage': true,
  reporter: ['html', 'text-summary'],
  // lines: 100,
  statements: 100,
  functions: 100,
  // branches: 100,
  all: true,
  include: ['test/**/*.ts', 'test/**/*.js'],
  exclude: [
    'ava.config.cjs',
    'nyc.config.js',
    'postcss.config.js',
    'coverage',
    'test',
    'dist',
    '.eslintrc.js',
    'test',
    'LICENSE.md',
    'README.md',
    '**/test/'
  ]
};

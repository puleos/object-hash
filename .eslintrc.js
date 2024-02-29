/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: "eslint:recommended",
  ignorePatterns: [
    "dist",
    "coverage"
  ],
  env: {
    node: true,
    es2024: true
  },
  overrides: [
    {
      env: {
        mocha: true
      },
      files: [
        "test/**/*.js"
      ]
    }
  ],
  rules: {
    "curly": "error",
    "eqeqeq": "error",
    "new-cap": ["error", { capIsNew: false }],
    "no-caller": "error"
  }
}

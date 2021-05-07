module.exports = {
  extends: "../../../.eslintrc.angular.json",
  overrides: [
    {
      files: [
        "*.ts"
      ],
      parserOptions: {
        project: ["tsconfig.app.json", "tsconfig.spec.json"],
        tsconfigRootDir: __dirname
      },
      rules: {}
    },
    {
      files: [
        "*.html"
      ],
      rules: {}
    }
  ]
}
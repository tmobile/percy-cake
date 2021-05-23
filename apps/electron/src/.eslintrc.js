module.exports = {
  extends: "../../../.eslintrc.angular.json",
  overrides: [
    {
      files: [
        "*.ts"
      ],
      parserOptions: {
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
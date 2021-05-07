module.exports = {
  extends: "../../../.eslintrc.json",
  overrides: [
    {
      files: [
        "*.ts"
      ],
      parserOptions: {
        tsconfigRootDir: __dirname
      },
      rules: {}
    }
  ]
}
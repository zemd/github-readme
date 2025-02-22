import typescript from "@zemd/eslint-ts";

export default [
  ...typescript(),
  {
    name: "zemd/overrides",
    rules: {
      "@typescript-eslint/no-implied-eval": "off",
      "@typescript-eslint/require-await": "off",
      "sonarjs/code-eval": "off",
      "sonarjs/slow-regex": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/no-commented-code": "off",
    },
  },
];

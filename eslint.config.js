import typescript from "@zemd/eslint-ts";

export default [
  ...typescript(),
  {
    name: "zemd/overrides",
    rules: {
      "@typescript-eslint/no-implied-eval": "off",
      "sonarjs/code-eval": "off",
      "sonarjs/slow-regex": "off",
      "sonarjs/no-nested-conditional": "off",
    },
  },
];

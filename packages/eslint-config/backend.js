import { config as baseConfig } from "./base.js";
import globals from "globals";

export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: globals.node,
    },
  },
];

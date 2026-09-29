import { mergeConfig } from "vite";
import baseConfig from "../../vite.config.js";

export default async (configEnv) => {
  const resolvedBase = typeof baseConfig === "function"
    ? await baseConfig(configEnv)
    : baseConfig;

  return mergeConfig(resolvedBase, {
    server: {
      watch: {
        ignored: ["**/.scratch/**", "**/output/**"],
      },
    },
  });
};

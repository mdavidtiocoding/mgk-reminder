import type { NextConfig } from "next"
import path from "path"
import { loadEnvConfig } from "@next/env"

import { loadLocalEnv } from "./lib/env/load-local-env"

const projectDir = path.resolve(__dirname)
loadLocalEnv(projectDir)
loadEnvConfig(projectDir)

const nextConfig: NextConfig = {
  turbopack: {
    root: projectDir,
  },
}

export default nextConfig

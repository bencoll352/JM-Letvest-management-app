import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = { output: 'export', outputFileTracingRoot:path.resolve(process.cwd()), images: { unoptimized: true } };
export default config;

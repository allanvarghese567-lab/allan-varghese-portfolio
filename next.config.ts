import type { NextConfig } from 'next';

const repo = 'allan-varghese-portfolio';
const isGithubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // Project site: https://allanvarghese567-lab.github.io/allan-varghese-portfolio/
  // GITHUB_PAGES=true in the deploy workflow so basePath applies only on Pages builds.
  ...(isGithubPages
    ? {
        basePath: `/${repo}`,
        assetPrefix: `/${repo}`,
      }
    : {}),
};

export default nextConfig;

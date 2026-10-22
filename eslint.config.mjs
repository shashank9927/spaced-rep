import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: [".playwright/**", "playwright-report/**", "test-results/**", "coverage/**"] },
  ...nextVitals,
];

export default config;

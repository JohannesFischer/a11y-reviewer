// Fixtures are imported as strings (see turbopack.rules in next.config.ts)
declare module "*.html" {
  const content: string;
  export default content;
}

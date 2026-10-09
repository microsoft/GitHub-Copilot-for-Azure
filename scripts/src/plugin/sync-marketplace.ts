import { syncMarketplacePlugins } from "./marketplace-helper.js";

function main(args: string[] = process.argv.slice(2)): void {
  if (args.length !== 4 || args.some(argument => argument.trim() === "")) {
    console.error("Usage: sync-marketplace <source-root> <target-root> <repository-url> <homepage-url>");
    process.exit(1);
  }

  const [sourceRoot, targetRoot, repository, homepage] = args;
  syncMarketplacePlugins({ sourceRoot, targetRoot, repository, homepage });
}

main();

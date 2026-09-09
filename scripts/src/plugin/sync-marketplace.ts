import { syncMarketplacePlugins } from "./marketplace-helper.js";

function main(args: string[] = process.argv.slice(2)): void {
  if (args.length !== 4 || args.some(argument => argument.trim() === "")) {
    throw new Error("Usage: sync-marketplace <source-root> <target-root> <repository-url> <homepage-url>");
  }

  const [sourceRoot, targetRoot, repository, homepage] = args;
  syncMarketplacePlugins({ sourceRoot, targetRoot, repository, homepage });
}

main();

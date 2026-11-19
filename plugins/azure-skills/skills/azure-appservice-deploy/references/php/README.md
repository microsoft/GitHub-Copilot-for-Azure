# PHP

- [Detect the framework, document root, and writable paths](detect.md). Discover Linux runtimes with `az webapp list-runtimes --os linux --runtime php -o json`. Select `PHP:<version>` compatible with Composer's PHP constraint and the user's request.
- [Set startup and app settings](startup-commands.md) for the detected framework.
- CLI: [create and verify a PHP source ZIP](package.md) and enable Oryx Composer build.
- azd: PHP has no native azd language. Only use an existing compatible `language: js` upload configuration. Check for accidental npm build steps and verify that the package excludes `vendor`, `.env*`, and cached configuration and preserves Laravel's required paths. Stop if the configured package cannot meet those rules; don't change the service language automatically.

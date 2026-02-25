/**
 * File System Utilities
 *
 * Utilities for filtering and collecting meaningful files from a workspace,
 * excluding derivative/generated content.
 */

import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";

export interface FileFilterOptions {
    /** File extensions to include (e.g., ".js", ".ts"). Case-insensitive. */
    includeExtensions?: string[];
    /** Explicit filenames to include (e.g., "Dockerfile"). Case-insensitive. */
    includeFilenames?: string[];
    /** Directory names to exclude (e.g., "node_modules"). Case-insensitive. */
    excludeDirectories?: string[];
}

/** Default extensions for source code, config, IaC, and docs */
export const DEFAULT_INCLUDE_EXTENSIONS = [
    // Source code
    ".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cs", ".go", ".rb", ".php",
    // Config
    ".json", ".yaml", ".yml", ".xml", ".toml", ".ini", ".conf",
    // IaC
    ".tf", ".bicep", ".helm",
    // Docs
    ".md", ".rst", ".txt",
    // Project files
    ".csproj", ".fsproj", ".vbproj", ".sln", ".gradle",
];

/** Default filenames for dependency manifests and important project files */
export const DEFAULT_INCLUDE_FILENAMES = [
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "package.json",
    "requirements.txt",
    "pom.xml",
    "build.gradle",
    "pipfile",
    "pyproject.toml",
    "cargo.toml",
    "makefile",
    "rakefile",
    "gemfile",
    ".gitignore",
    ".env.example",
    "azure.yaml",
];

/** Default directories to exclude (derivative/generated content) */
export const DEFAULT_EXCLUDE_DIRECTORIES = [
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "bin",
    "obj",
    "target",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".output",
    "coverage",
    ".cache",
    ".venv",
    "venv",
    "env",
    ".env",
    ".tox",
    ".eggs",
    ".egg-info",
    ".gradle",
    ".idea",
    ".vscode",
    ".vs",
    "packages",
    ".terraform",
];

/**
 * Recursively collect files from a directory that match the include criteria
 * while excluding specified directories.
 *
 * @param rootDir - The root directory to start collecting from
 * @param options - Filter options for extensions, filenames, and excluded directories
 * @returns Array of relative file paths matching the criteria
 */
export function collectFiles(
    rootDir: string,
    options: FileFilterOptions = {}
): string[] {
    const includeExtensions = new Set(
        (options.includeExtensions ?? DEFAULT_INCLUDE_EXTENSIONS).map(e => e.toLowerCase())
    );
    const includeFilenames = new Set(
        (options.includeFilenames ?? DEFAULT_INCLUDE_FILENAMES).map(f => f.toLowerCase())
    );
    const excludeDirectories = new Set(
        (options.excludeDirectories ?? DEFAULT_EXCLUDE_DIRECTORIES).map(d => d.toLowerCase())
    );

    const collected: string[] = [];

    function walk(dir: string): void {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return; // Skip directories we can't read
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(rootDir, fullPath);

            if (entry.isDirectory()) {
                // Skip excluded directories
                if (excludeDirectories.has(entry.name.toLowerCase())) {
                    continue;
                }
                walk(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                const filename = entry.name.toLowerCase();

                // Include if extension matches or filename matches
                if (includeExtensions.has(ext) || includeFilenames.has(filename)) {
                    collected.push(relativePath);
                }
            }
        }
    }

    walk(rootDir);
    return collected;
}

/**
 * Create a zip archive from a list of files.
 * Cross-platform implementation using archiver (works on Windows, macOS, Linux).
 *
 * @param rootDir - The root directory containing the files
 * @param files - Array of relative file paths to include
 * @param outputPath - Path where the zip file will be written
 * @param timeoutMs - Timeout in milliseconds (default: 5 minutes)
 * @returns Promise that resolves when the archive is complete
 */
export async function createZipArchive(
    rootDir: string,
    files: string[],
    outputPath: string,
    timeoutMs: number = 5 * 60 * 1000
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let archive: archiver.Archiver | undefined;
        const timeoutId = setTimeout(() => {
            if (archive) {
                archive.abort();
            }
            reject(new Error(`Zip archive creation timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const output = fs.createWriteStream(outputPath);
        archive = archiver("zip", {
            zlib: { level: 6 } // Compression level (0-9)
        });

        output.on("close", () => {
            clearTimeout(timeoutId);
            resolve(undefined);
        });
        output.on("error", (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
        archive.on("error", (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
        archive.on("warning", (err) => {
            if (err.code !== "ENOENT") {
                clearTimeout(timeoutId);
                reject(err);
            }
        });

        archive.pipe(output);

        // Add each file to the archive
        for (const file of files) {
            const fullPath = path.join(rootDir, file);
            if (fs.existsSync(fullPath)) {
                // Use forward slashes for cross-platform zip compatibility
                archive.file(fullPath, { name: file.replace(/\\/g, "/") });
            }
        }

        void archive.finalize();
    });
}

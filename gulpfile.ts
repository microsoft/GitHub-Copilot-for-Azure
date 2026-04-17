import { src, dest } from "gulp";
import { Transform } from "stream";
import * as nbgv from "nerdbank-gitversioning";
import * as path from "path";
import Vinyl = require("vinyl");

const TOP_LEVEL_SKILL_RE = /^skills[\\/][^\\/]+[\\/]SKILL\.md$/;

function stampVersion() {
  return new Transform({
    objectMode: true,
    async transform(file: Vinyl, _encoding, callback) {
      if (!TOP_LEVEL_SKILL_RE.test(file.relative)) {
        callback(null, file);
        return;
      }

      try {
        const skillName = file.relative.split(path.sep)[1];
        const sourceSkillDir = path.resolve("plugin/skills", skillName);
        const versionInfo = await nbgv.getVersion(sourceSkillDir);
        const version = versionInfo.simpleVersion;

        const content = file.contents!.toString();
        const updated = content.replace(
          /(version:\s*")0\.0\.0-placeholder(")/,
          `$1${version}$2`
        );
        file.contents = Buffer.from(updated);

        console.log(`skills/${skillName}: ${version}`);
      } catch (err) {
        callback(err as Error);
        return;
      }

      callback(null, file);
    },
  });
}

function build() {
  return src("plugin/**/*", { dot: true, encoding: false })
    .pipe(stampVersion())
    .pipe(dest("output"));
}

export default build;

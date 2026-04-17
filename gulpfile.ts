import { src, dest } from "gulp";

function copyPlugin() {
  return src("plugin/**/*", { dot: true, encoding: false }).pipe(dest("output"));
}

export default copyPlugin;

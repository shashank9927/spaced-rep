const { statSync } = require("node:fs");
const { resolve } = require("node:path");
const { globSync: tinyGlobSync, isDynamicPattern } = require("tinyglobby");

// Next's ESLint plugin only consumes globSync(pattern, { onlyDirectories: true }).
// Keep literal roots literal: tinyglobby otherwise expands directories and can
// mishandle an absolute pattern equal to its working directory on Windows.
function globSync(pattern, options = {}) {
  if (typeof pattern !== "string" || options.onlyDirectories !== true) {
    throw new TypeError("The Next ESLint glob adapter supports directory patterns only.");
  }
  if (!isDynamicPattern(pattern)) {
    const entry = statSync(resolve(options.cwd ?? process.cwd(), pattern), { throwIfNoEntry: false });
    return entry?.isDirectory() ? [pattern] : [];
  }
  return tinyGlobSync(pattern, { ...options, expandDirectories: false });
}

module.exports = { globSync };

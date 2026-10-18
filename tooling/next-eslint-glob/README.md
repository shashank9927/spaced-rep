# Next ESLint directory lookup

This private adapter replaces `fast-glob` **only under** `@next/eslint-plugin-next`.
Next 16.4.2 uses just `globSync(pattern, { onlyDirectories: true })` to resolve
`settings.next.rootDir`. The adapter supplies that operation with `tinyglobby`,
which is already used elsewhere in our development tools.

The root `fast-glob` development dependency supplies the override through npm's
`$fast-glob` reference. `.npmrc` sets `install-links=true` so both local installs
and CI package the adapter instead of creating platform-specific directory links.

The upstream `fast-glob` dependency pulls in `braces` 3.0.3, affected by
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
with no patched release available when this override was added. This removes
the vulnerable chain while keeping Next 16's lint rules and the full CI audit.
It is not a general-purpose replacement for all of `fast-glob`'s APIs.

The compatibility tests exercise the installed Next plugin's root resolution
with literal, wildcard, brace, array, absolute, and missing directory roots.
Remove the override and this package once Next's ESLint plugin ships without
the affected dependency, and recheck this contract when upgrading the plugin.

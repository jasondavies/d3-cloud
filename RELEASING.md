# Releasing

This repository does not currently automate npm publishes. Use this checklist
to keep the npm package, git tags, and GitHub releases aligned.

## Pick the release branch

Release from the branch that matches the line you intend to publish.

- Release `2.x` from the current `v2` branch.
- Release `1.x` patches from the maintenance branch for that line.

Do not publish from a dirty worktree.

## First 2.x release

Recommended rollout:

1. Publish a prerelease such as `2.0.0-rc.0` with `--tag next`, leaving
   `latest` on 1.x while downstream maintainers try the new API. Use both a
   prerelease version and the tag: a stable `2.0.0` published under `next`
   still satisfies broad semver ranges such as `>=1`.
2. Include [MIGRATING.md](./MIGRATING.md) in the npm tarball and link it from
   the README and GitHub release. Show how to stay on 1.x as well as upgrade.
3. Before publishing stable v2, seek migration feedback from direct consumers
   such as visx, Superset, AntV F2, and React wrapper maintainers. Prepare a
   small integration patch or example with the guide. This checklist does
   not mean that outreach or downstream validation has already happened.
4. Test a prerelease or local tarball in at least one real downstream wrapper.
   Check its production bundle, TypeScript build, rendering, lifecycle cleanup,
   and any CommonJS output. Passing d3-cloud's own suite is not sufficient to
   establish wrapper compatibility.
5. Keep published 1.x versions available and establish the 1.x maintenance
   branch and support scope before the stable release. Do not deprecate all
   1.x versions just because v2 exists. Link versioned v1 documentation from
   the announcement, and update maintained legacy examples to pin their CDN
   URLs to a 1.x version.
6. Publish stable `2.0.0` with `--tag latest` only when ready for new installs
   and unversioned CDN requests to receive v2. Publish subsequent 1.x patches
   with `--tag legacy`, so they do not move `latest` back to v1.

The guide's 1.x ranges exclude v2, independently of the `latest` tag.
Unbounded ranges, explicit `@latest` installs, major-version overrides,
unversioned CDN scripts, and Git dependencies on moving branches need separate
attention. A lockfile helps applications reproduce installs but does not replace
a library's dependency range. See
[npm's range semantics](https://github.com/npm/node-semver#ranges),
[npm dist-tags](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/), and
[UNPKG version resolution](https://unpkg.com/).

### Downstream audit: 2026-09-23

This is a targeted survey of notable integrations, not a download ranking or
an exhaustive dependent scan. Both published npm manifests and upstream source
were inspected. No downstream build was run as part of this audit.

| Integration | Published package inspected | d3-cloud dependency | Effect of publishing v2 |
| --- | --- | --- | --- |
| Vega | [vega-wordcloud 5.1.3](https://registry.npmjs.org/vega-wordcloud/5.1.3) | None; vendored implementation | No automatic replacement |
| Airbnb visx | [@visx/wordcloud 4.0.0](https://registry.npmjs.org/@visx/wordcloud/4.0.0) | `^1.2.7` | Remains on 1.x |
| Apache Superset | [@superset-ui/plugin-chart-word-cloud 0.20.4](https://registry.npmjs.org/@superset-ui/plugin-chart-word-cloud/0.20.4) | `^1.2.7` | Remains on 1.x |
| AntV F2 | [@antv/f2 5.14.0](https://registry.npmjs.org/@antv/f2/5.14.0) | `~1.2.5` | Remains on 1.x |
| react-wordcloud | [1.2.7](https://registry.npmjs.org/react-wordcloud/1.2.7) | `^1.2.5` | Remains on 1.x |
| react-d3-cloud | [1.0.6](https://registry.npmjs.org/react-d3-cloud/1.0.6) | `^1.2.5` | Remains on 1.x |

Vega's [Wordcloud transform](https://github.com/vega/vega/blob/b570ef375a28b6ac9c2f8ee10ceae6bb2df12517/packages/vega-wordcloud/src/Wordcloud.js)
imports its own [CloudLayout.js](https://github.com/vega/vega/blob/b570ef375a28b6ac9c2f8ee10ceae6bb2df12517/packages/vega-wordcloud/src/CloudLayout.js),
derived from d3-cloud. It is not a direct npm consumer. Adopting v2 there would
be a separate integration project.

The current [Superset source manifest](https://github.com/apache/superset/blob/7c7b3adf74553aaee953f62c1a43efaa87913e20/superset-frontend/plugins/plugin-chart-word-cloud/package.json)
uses `^1.2.9`, unlike the published package above; both exclude v2.
Its [renderer](https://github.com/apache/superset/blob/7c7b3adf74553aaee953f62c1a43efaa87913e20/superset-frontend/plugins/plugin-chart-word-cloud/src/chart/WordCloud.tsx)
uses accessors and `on("end")` and retries at larger sizes. Preserve bounded
placement and its acceptance criteria when porting it.

The [visx hook](https://github.com/airbnb/visx/blob/485c0359664ee8e612992defb16e1f035ed40b23/packages/visx-wordcloud/src/useWordcloud.ts)
uses the factory, accessors, events, `start()`, and `stop()` on effect cleanup.
It also carries [local v1 declarations](https://github.com/airbnb/visx/blob/485c0359664ee8e612992defb16e1f035ed40b23/packages/visx-wordcloud/src/types.ts).
A migration must address those contracts and the package's CommonJS output,
not just change its version range. The two React wrappers also publish
CommonJS entry points, so module compatibility needs checking there too.

## Prepare the release

1. Confirm the target version and release line.
2. Update `package.json` and the root version entries in `package-lock.json`
   to the version you are publishing. For example,
   `npm version 2.0.0-rc.0 --no-git-tag-version` prepares a prerelease without
   creating the release commit or tag yet.
3. If dependencies changed, update `package-lock.json` with `npm install`.
4. Update `CHANGELOG.md`:
   - Change `## [x.y.z] - Unreleased` to the release date.
   - Keep the notes accurate for the version being published.
5. Run the full local checks:

```sh
npm test
npm run check:examples
npm run check:package
```

6. Inspect the tarball contents one more time if needed:

```sh
npm pack --dry-run --cache /tmp/d3-cloud-npm-cache
```

## Publish

1. Commit the release changes.
2. Create an annotated tag that matches the npm version exactly:

```sh
git tag -a vX.Y.Z -m "vX.Y.Z"
```

3. Publish to npm with the intended distribution tag. Choose one command for
   the release being prepared:

```sh
# Prerelease, for example 2.0.0-rc.0:
npm publish --tag next

# Stable 2.x release:
npm publish --tag latest

# A 1.x maintenance patch after 2.x is latest:
npm publish --tag legacy
```

   Inspect `npm dist-tag ls d3-cloud` before and after publishing. A bare
   `npm publish` changes `latest`, including when the version is a prerelease.

4. Push the branch and tag:

```sh
git push origin <branch>
git push origin vX.Y.Z
```

5. Create the GitHub release from the same tag and reuse the changelog notes.

## Important notes

- Keep `package.json`, the git tag, and the GitHub release on the same version.
  The package on npm has already moved past the newest git tag in this clone,
  which makes release history harder to audit.
- The root `package-lock.json` is tracked for reproducible development and CI
  installs. Keep it aligned with `package.json` whenever dependencies change.
- If you later automate publishing, prefer npm trusted publishing from GitHub
  Actions over long-lived npm tokens. npm documents this as the recommended
  setup because it uses short-lived OIDC credentials and automatically produces
  provenance for public packages.

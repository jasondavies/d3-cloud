# Releasing

This repository does not currently automate npm publishes. Use this checklist
to keep the npm package, git tags, and GitHub releases aligned.

## Pick the release branch

Release from the branch that matches the line you intend to publish.

- Release `2.x` from the current `v2` branch.
- Release `1.x` patches from the maintenance branch for that line.

Do not publish from a dirty worktree.

## Prepare the release

1. Confirm the target version and release line.
2. Update `package.json` to the version you are publishing.
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

3. Publish to npm:

```sh
npm publish
```

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

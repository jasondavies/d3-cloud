# Releasing

npm publishes are manual. Keep the npm version, the git tag, and the GitHub
release on the same version.

## Prepare

1. Release 2.x from `main` and 1.x patches from the `1.x` branch. Start from
   a clean working tree.
2. Set the version in `package.json` and `package-lock.json`:

   ```sh
   npm version X.Y.Z --no-git-tag-version
   ```

3. In `CHANGELOG.md`, replace `Unreleased` with the release date, or note the
   prerelease, and check that the notes match what is being published.
4. Run the tests, type checks, example checks, and a dry-run pack:

   ```sh
   npm run check:package
   ```

## Publish

1. Commit, then create an annotated tag that matches the npm version exactly:

   ```sh
   git tag -a vX.Y.Z -m "vX.Y.Z"
   ```

2. Publish with the distribution tag for the release line:

   ```sh
   npm publish --tag next     # prereleases, such as 2.0.0-rc.1
   npm publish --tag latest   # stable 2.x releases
   npm publish --tag legacy   # 1.x patches once 2.x is latest
   ```

   A bare `npm publish` moves `latest`, even for a prerelease. Check
   `npm dist-tag ls d3-cloud` before and after publishing.

3. Push the branch and the tag:

   ```sh
   git push origin <branch> vX.Y.Z
   ```

4. Create the GitHub release from the tag, reusing the changelog notes. Mark
   prereleases as such.

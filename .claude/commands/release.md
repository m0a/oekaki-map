---
description: Create a new patch release with automatic version increment (e.g., v0.0.11 -> v0.0.12)
---

## Release Workflow

Execute the following steps to create a new patch release:

1. **Get latest tag**: Run `git tag -l --sort=-version:refname | head -1` to find the current latest version tag.

2. **Calculate next version**: Parse the latest tag (e.g., v0.0.11) and increment the patch version (e.g., v0.0.12).

3. **Get changes since last tag**: Run `git log <latest-tag>..HEAD --oneline` to list all commits that will be included in this release.

4. **Verify there are changes**: If no commits since last tag, inform the user and abort.

5. **Show release preview**: Display:
   - Current latest tag
   - Next version tag to be created
   - List of commits to be included
   - Ask user for confirmation before proceeding

6. **Create and push tag**:
   - `git tag <next-version>`
   - `git push origin <next-version>`

7. **Create GitHub release**: Use `gh release create <next-version> --title "<next-version>" --notes "<changelog>"` with the commit messages formatted as changelog.

8. **Monitor deployment**: Check GitHub Actions workflow status with `gh run list --limit 1` and report when production deployment completes.

# Arubis for Mac and Windows

The Arubis accounting app in its own window, with native menus, saved window size, file downloads and printing.
It opens https://arubis.olympuspay.co and needs an internet connection.

## Build locally

    npm install
    npm start            # run it
    npm run dist:mac     # Mac .dmg and .zip in dist/
    npm run dist:win     # Windows installer in dist/ (best built on Windows)

## Release

Bump `version` in package.json, commit and push, then run the Release workflow in GitHub Actions. It builds the Mac (Apple
silicon and Intel) and Windows installers and publishes them as a release. Windows installs update themselves from
the latest release.

## Signing

The builds are not yet signed. On a Mac, the first open needs Control-click, Open (or System Settings, Privacy and
Security, Open Anyway). On Windows, SmartScreen asks once: More info, Run anyway. To sign:

- Mac: add an Apple Developer ID certificate and notarisation credentials as repository secrets
  (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) and remove
  `"identity": "-"` from package.json.
- Windows: add a code signing certificate as `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.

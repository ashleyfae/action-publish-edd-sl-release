# Publish EDD SL Release

A GitHub Action that publishes WordPress plugin releases to an [Easy Digital Downloads Software Licensing Releases](https://github.com/ashleyfae/edd-sl-releases) API endpoint.

## Features

- Automatically parses changelog from WordPress `readme.txt` format
- Automatically parses requirements from WordPress `readme.txt` headers
- Converts changelog markdown to HTML
- Sends release metadata to EDD Software Licensing API

## Inputs

### `asset-url` (required)

URL to the release zip file. This should be the GitHub release asset URL.

### `file-name` (required)

Name of the release zip file (e.g., `my-plugin-1.0.0.zip`).

### `pre-release` (optional)

Whether this is a pre-release. Defaults to `'false'`.

### `readme-file` (optional)

Relative path to your `readme.txt` file. Defaults to `'readme.txt'`.

The action will automatically parse:
- **Changelog**: Most recent entry from the `== Changelog ==` section, converted to HTML
- **Requirements**: WordPress and PHP versions from the plugin headers:
  - `Requires at least:` → `wp` version
  - `Requires PHP:` → `php` version

## Required Secrets

You must configure the following secrets in your repository:

- `WORDPRESS_USER` - API authentication username
- `WORDPRESS_PASS` - API authentication password
- `WORDPRESS_RELEASE_URL` - Your EDD Software Licensing API endpoint URL -- e.g. `https://example.com/wp-json/af-edd-sl-releases/v1/products/<PRODUCT_ID>/releases`

## Example Usage

### Complete Workflow

This example shows a complete workflow that creates a release zip and publishes it to your EDD SL Releases API.

The workflow uses two actions in sequence:
1. `ashleyfae/action-build-release-zip` - Builds the plugin zip and uploads it to the GitHub release
2. `ashleyfae/action-publish-edd-sl-release` - Publishes release metadata to your EDD SL API

```yaml
name: Generate Installable Plugin, and Upload as Release Asset

on:
  release:
    types: [published]

jobs:
  build:
    name: Upload Release Asset
    runs-on: ubuntu-latest

    steps:
      - name: Build and upload release zip
        id: build-zip
        uses: ashleyfae/action-build-release-zip@main
        with:
          composer-install: 'true'

      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.release.tag_name }}

      - name: Publish release to EDD SL
        uses: ashleyfae/action-publish-edd-sl-release@main
        with:
          asset-url: ${{ steps.build-zip.outputs.asset-url }}
          file-name: ${{ steps.build-zip.outputs.file-name }}
          pre-release: ${{ github.event.release.prerelease }}
        env:
          WORDPRESS_USER: ${{ secrets.WORDPRESS_USER }}
          WORDPRESS_PASS: ${{ secrets.WORDPRESS_PASS }}
          WORDPRESS_RELEASE_URL: ${{ secrets.WORDPRESS_RELEASE_URL }}
```

**Key Points:**
- The `id: build-zip` allows you to reference the step's outputs
- The checkout step ensures `readme.txt` is available for the publish action to parse
- `asset-browser-download-url` from the build action is passed to `asset-url` in the publish action
- Both actions run in the same job, so no need for job-level outputs

### With Custom readme.txt Path

If your readme.txt is in a different location:

```yaml
- name: Publish release
  uses: ashleyfae/action-publish-edd-sl-release@main
  with:
    asset-url: ${{ steps.build-zip.outputs.asset-url }}
    file-name: ${{ steps.build-zip.outputs.file-name }}
    readme-file: 'docs/readme.txt'
    pre-release: ${{ github.event.release.prerelease }}
  env:
    WORDPRESS_USER: ${{ secrets.WORDPRESS_USER }}
    WORDPRESS_PASS: ${{ secrets.WORDPRESS_PASS }}
    WORDPRESS_RELEASE_URL: ${{ secrets.WORDPRESS_RELEASE_URL }}
```

### Standalone Usage

If you already have the asset URL from another workflow or source:

```yaml
- name: Publish release
  uses: ashleyfae/action-publish-edd-sl-release@main
  with:
    asset-url: https://github.com/owner/repo/releases/download/v1.0.0/plugin.zip
    file-name: my-plugin-1.0.0.zip
    pre-release: 'false'
  env:
    WORDPRESS_USER: ${{ secrets.WORDPRESS_USER }}
    WORDPRESS_PASS: ${{ secrets.WORDPRESS_PASS }}
    WORDPRESS_RELEASE_URL: ${{ secrets.WORDPRESS_RELEASE_URL }}
```

## readme.txt Format

The action expects your `readme.txt` to follow the WordPress plugin readme format.

### Plugin Headers

The action parses requirements from the standard WordPress plugin headers:

```
=== Ultimate Book Blogger ===
Author URI: https://www.nosegraze.com
Plugin URI: https://shop.nosegraze.com/product/ultimate-book-blogger-plugin/
Requires at least: 5.0
Requires PHP: 7.4
Tested up to: 6.1.1
License: GNU Version 2 or Any Later Version
```

From these headers, the action extracts:
- `Requires at least:` → `wp: "5.0"`
- `Requires PHP:` → `php: "7.4"`

This creates a requirements object:
```json
{
  "wp": "5.0",
  "php": "7.4"
}
```

### Changelog Format

The action parses the changelog section:

```
== Changelog ==

**3.9.3 - 29 December 2025**

* Fix: Some books not appearing in archives if some books had been deleted
* Fix: Conflict with series ratings

**3.9.2 - 1 June 2025**

* Fix: Reviews by rating not working as expected
```

The action will automatically extract the most recent version entry (the first `**VERSION**` block, excluding version) and convert it to HTML:

```html
<ul>
  <li>Fix: Some books not appearing in archives if some books had been deleted</li>
  <li>Fix: Conflict with series ratings</li>
</ul>
```

## API Request

The action sends a POST request to your `WORDPRESS_RELEASE_URL` with the following data:

- `git_asset_url` - URL to the release zip file
- `version` - Release version (from Git tag)
- `file_name` - Name of the release file
- `pre_release` - Whether this is a pre-release
- `requirements` - System requirements from readme.txt headers (as JSON string)
- `changelog` - HTML formatted changelog from readme.txt

The request uses HTTP Basic Authentication with `WORDPRESS_USER` and `WORDPRESS_PASS`.

## License

This action is provided as-is for use with EDD Software Licensing Releases.

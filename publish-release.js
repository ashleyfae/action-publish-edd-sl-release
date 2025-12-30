#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ============================================================================
// PART 1: Environment Variable Validation
// ============================================================================

function validateEnvironment() {
  const required = {
    WORDPRESS_USER: 'WordPress API username',
    WORDPRESS_PASS: 'WordPress API password',
    WORDPRESS_RELEASE_URL: 'WordPress release API endpoint',
    ASSET_URL: 'Release asset URL',
    FILE_NAME: 'Release file name',
    RELEASE_VERSION: 'Release version'
  };

  const missing = [];
  for (const [key, description] of Object.entries(required)) {
    if (!process.env[key]) {
      missing.push(`${key} (${description})`);
    }
  }

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(item => console.error(`  - ${item}`));
    process.exit(1);
  }
}

// ============================================================================
// PART 2: Requirements Parsing from readme.txt
// ============================================================================

function parseRequirements(readmeFilePath) {
  if (!readmeFilePath || !fs.existsSync(readmeFilePath)) {
    console.log('No readme file found; no requirements to parse.');
    return null;
  }

  try {
    console.log(`Parsing requirements from ${readmeFilePath}`);
    const content = fs.readFileSync(readmeFilePath, 'utf-8');
    const requirements = {};

    // Parse "Requires at least: X.X" for WordPress version
    const wpMatch = content.match(/^Requires at least:\s*(.+)$/im);
    if (wpMatch) {
      requirements.wp = wpMatch[1].trim();
    }

    // Parse "Requires PHP: X.X" for PHP version
    const phpMatch = content.match(/^Requires PHP:\s*(.+)$/im);
    if (phpMatch) {
      requirements.php = phpMatch[1].trim();
    }

    // Return null if no requirements found
    if (Object.keys(requirements).length === 0) {
      console.log('No requirements found in readme.txt');
      return null;
    }

    console.log('Found requirements:', requirements);
    return requirements;
  } catch (error) {
    console.error(`Error parsing requirements: ${error.message}`);
    return null;
  }
}

// ============================================================================
// PART 3: Changelog Parsing
// ============================================================================

function parseChangelog(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log(`No readme file found at ${filePath || 'undefined'}`);
    return '';
  }

  try {
    console.log(`Parsing changelog from ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Find "== Changelog ==" section
    const changelogMatch = content.match(/^==\s*Changelog\s*==/im);
    if (!changelogMatch) {
      console.warn('No changelog section found in readme.txt');
      return '';
    }

    // Extract changelog section
    const startIndex = changelogMatch.index + changelogMatch[0].length;
    const remainingContent = content.substring(startIndex);
    const nextSectionMatch = remainingContent.match(/^==/m);
    const changelogText = nextSectionMatch
      ? remainingContent.substring(0, nextSectionMatch.index)
      : remainingContent;

    // Find first version block
    // Match: **VERSION** followed by content until next ** or end of string
    // No 'm' flag so $ only matches at true end of string, not at each line ending
    const versionBlockRegex = /\*\*([^*]+)\*\*[^\n]*\n([\s\S]*?)(?=\n\*\*|$)/;
    const match = changelogText.match(versionBlockRegex);

    if (!match) {
      console.warn('No version entries found in changelog');
      return '';
    }

    const changeItems = match[2].trim();

    console.log('Parsed changelog items: ', changeItems);

    // Extract bullet points
    const lines = changeItems.split('\n');
    const bulletPoints = lines
      .map(line => line.trim())
      .filter(line => line.startsWith('*') || line.startsWith('-'))
      .map(line => line.substring(1).trim())
      .filter(line => line.length > 0);

    if (bulletPoints.length === 0) {
      console.warn('No bullet points found. Lines: ', lines);
      return '';
    }

    return '<ul>\n' +
      bulletPoints.map(item => `  <li>${escapeHtml(item)}</li>`).join('\n') +
      '\n</ul>';

  } catch (error) {
    console.error(`Error parsing changelog: ${error.message}`);
    return '';
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// PART 4: API Request
// ============================================================================

function makeApiRequest(data, auth) {
  return new Promise((resolve, reject) => {
    const url = process.env.WORDPRESS_RELEASE_URL;
    const protocol = url.startsWith('https://') ? https : http;

    // Build JSON payload
    const payload = JSON.stringify(data);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString('base64')}`
      }
    };

    const req = protocol.request(url, options, (res) => {
      let body = '';

      console.log('\n=== API Response ===');
      console.log('Status code:', res.statusCode);

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {

        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(body);
            resolve(json);
          } catch (error) {
            console.log('Response body:', body);
            console.log('====================\n');
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        } else {
          console.log('Response body:', body);
          console.log('====================\n');
          reject(new Error(`API request failed with status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`API request error: ${error.message}`));
    });

    req.write(payload);
    req.end();
  });
}

// ============================================================================
// PART 5: Main Execution
// ============================================================================

async function main() {
  try {
    // Validate environment
    validateEnvironment();

    // Parse requirements from readme.txt
    const requirements = parseRequirements(process.env.README_FILE);

    // Parse changelog from readme.txt
    const changelog = parseChangelog(process.env.README_FILE);

    // Get file name and asset URL from environment
    const assetUrl = process.env.ASSET_URL;
    const fileName = process.env.FILE_NAME;

    // Prepare API request data
    const requestData = {
      git_asset_url: assetUrl,
      version: process.env.RELEASE_VERSION,
      file_name: fileName,
      pre_release: process.env.PRE_RELEASE || 'false',
      changelog: changelog
    };

    // Add requirements if present
    if (requirements) {
      requestData.requirements = requirements;
    }

    console.log(`\nVersion ${process.env.RELEASE_VERSION} requirements:`, requirements || 'none');
    console.log(`Deploying asset: ${assetUrl}\n`);

    // Make API request
    const response = await makeApiRequest(requestData, {
      user: process.env.WORDPRESS_USER,
      pass: process.env.WORDPRESS_PASS
    });

    console.log('API response:', JSON.stringify(response, null, 2));

    // Validate response
    if (!response.id || response.id === null) {
      console.error('No release ID in response.');
      process.exit(1);
    }

    console.log(`\nSuccessfully created release #${response.id}`);
    process.exit(0);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run main function
if (process.argv[2] === 'test-changelog') {
  // Test mode: node publish-release.js test-changelog path/to/readme.txt
  const testFile = process.argv[3] || 'readme.txt';
  console.log('Testing changelog parsing with:', testFile);
  const result = parseChangelog(testFile);
  console.log('\n=== Parsed Changelog HTML ===');
  console.log(result);
  console.log('=============================\n');
} else {
  main();
}

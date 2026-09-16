const fs = require('fs');
const https = require('https');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');

// 1. Parse FA CSS URL from <link> tag
const linkMatch = html.match(/<link[^>]+href="([^"]*font-awesome[^"]*\.css[^"]*)"/i);
if (!linkMatch) { console.error('No Font Awesome CSS link found in index.html'); process.exit(1); }
const cssUrl = linkMatch[1];
console.log('CSS URL:', cssUrl);

// 2. Parse icon classes from lunchMenu array
const menuBlock = html.match(/const lunchMenu = \[([\s\S]*?)\];/);
if (!menuBlock) { console.error('No lunchMenu array found in index.html'); process.exit(1); }
const iconMatches = [...menuBlock[1].matchAll(/icon:\s*"([^"]+)"/g)];
const classes = iconMatches.map(m => m[1].trim());
console.log('Icon classes found:', classes.length);
console.log('');

// 3. Fetch CSS
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  const css = await fetch(cssUrl);
  console.log('CSS length:', css.length, 'bytes');
  console.log('');

  let missing = 0;
  for (const full of classes) {
    // full is like "fas fa-pizza-slice" — we need the second token
    const parts = full.split(/\s+/);
    const iconClass = parts[parts.length - 1]; // e.g. "fa-pizza-slice"

    // FA defines icons as .fa-NAME:before{content:"..."} or .fa-NAME,.fa-ALIAS:before
    // We look for the :before definition which is what makes the icon render.
    const escaped = iconClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern1 = new RegExp('\\.' + escaped + '\\s*:\\s*before', 'i');
    const pattern2 = new RegExp('\\.' + escaped + '\\s*,', 'i');

    // Also check if it appears as a standalone class selector (in a comma list before :before)
    const found = pattern1.test(css) || pattern2.test(css);

    const status = found ? 'FOUND' : 'MISSING';
    if (!found) missing++;
    console.log(`${iconClass}: ${status}`);
  }

  console.log('');
  console.log(`Total: ${classes.length} icons, ${missing} MISSING, ${classes.length - missing} FOUND`);
  console.log(`Probability of blank icon per click: ${missing}/${classes.length} = ${(missing / classes.length * 100).toFixed(1)}%`);
})();

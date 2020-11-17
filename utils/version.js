const json = require('../package.json');
const timestamp = json.dependencies.playwright.replace(/.*next\./, '');
console.log(json.version + '.' + timestamp);

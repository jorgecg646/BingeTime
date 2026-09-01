const fs = require('fs');
const path = require('path');

// 1. Load variables from local .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      val = val.replace(/^['"](.*)['"]$/, '$1'); // remove quotes if any
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
  console.log('Loaded variables from .env');
}

// Paths for template and target files
const templatePath = path.join(__dirname, 'src', 'environments', 'environment.prod.template.ts');
const targetPath = path.join(__dirname, 'src', 'environments', 'environment.prod.ts');
const devTargetPath = path.join(__dirname, 'src', 'environments', 'environment.ts');
const devTemplatePath = path.join(__dirname, 'src', 'environments', 'environment.example.ts');

console.log('Running set-env.js to generate environment files...');

// Ensure the directory exists
const envDir = path.join(__dirname, 'src', 'environments');
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Extract TMDB token/key (supporting TMBD_API_READ, TMDB_API_READ, and variants)
const tmdbToken = process.env.TMBD_API_READ || 
                  process.env.TMDB_API_READ || 
                  process.env.TMDB_API_READ_ACCESS_TOKEN || 
                  process.env.TMDB_API_TOKEN || 
                  process.env.TMDB_TOKEN || 
                  process.env.TMDB_READ_TOKEN || '';
const tmdbKey = process.env.TMDB_API_KEY || 
                process.env.TMBD_API_KEY || 
                process.env.TMDB_KEY || '';

// 2. Generate local/dev environment.ts with TMDB token if available
let devContent = fs.existsSync(devTemplatePath)
  ? fs.readFileSync(devTemplatePath, 'utf8')
  : `export const environment = {
  production: false,
  netlifyUrl: 'https://bingetimes.netlify.app',
  tmdbBaseUrl: 'https://api.themoviedb.org/3',
  tmdbImageBaseUrl: 'https://image.tmdb.org/t/p',
  tmdbApiToken: '${tmdbToken}',
  tmdbApiKey: '${tmdbKey}'
};
`;

if (tmdbToken || tmdbKey) {
  devContent = devContent.replace("tmdbApiToken: ''", `tmdbApiToken: '${tmdbToken}'`);
  devContent = devContent.replace("tmdbApiKey: ''", `tmdbApiKey: '${tmdbKey}'`);
}
fs.writeFileSync(devTargetPath, devContent, 'utf8');
console.log(`Development environment file generated: ${devTargetPath}`);

// 3. Generate production environment.prod.ts with TMDB tokens
try {
  let prodContent = fs.readFileSync(templatePath, 'utf8');
  prodContent = prodContent.replace('__TMDB_API_TOKEN__', tmdbToken);
  prodContent = prodContent.replace('__TMDB_API_KEY__', tmdbKey);

  fs.writeFileSync(targetPath, prodContent, 'utf8');
  console.log(`Production environment file generated: ${targetPath}`);
} catch (error) {
  console.error('Error generating production environment file:', error);
  process.exit(1);
}



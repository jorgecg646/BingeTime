const fs = require('fs');
const path = require('path');

// Paths for template and target files
const templatePath = path.join(__dirname, 'src', 'environments', 'environment.prod.template.ts');
const targetPath = path.join(__dirname, 'src', 'environments', 'environment.prod.ts');
const devTargetPath = path.join(__dirname, 'src', 'environments', 'environment.ts');
const devTemplatePath = path.join(__dirname, 'src', 'environments', 'environment.example.ts');

console.log('Running set-env.js to inject production environment variables...');

// Ensure the directory exists
const envDir = path.join(__dirname, 'src', 'environments');
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// 1. Also generate a basic environment.ts if it does not exist in Git (required by Angular compiler for replacement)
if (!fs.existsSync(devTargetPath)) {
  console.log('Generating placeholder environment.ts...');
  if (fs.existsSync(devTemplatePath)) {
    fs.copyFileSync(devTemplatePath, devTargetPath);
  } else {
    fs.writeFileSync(devTargetPath, `export const environment = { production: false, netlifyUrl: '', supabaseUrl: '', supabaseKey: '' };\n`, 'utf8');
  }
}

// 2. Read env variables from Netlify build process, supporting native Supabase Integration variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_DATABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('WARNING: SUPABASE_URL or SUPABASE_ANON_KEY environment variables are not set.');
}

try {
  let content = fs.readFileSync(templatePath, 'utf8');

  // Replace placeholder tokens with actual values
  content = content.replace('SUPABASE_URL_PLACEHOLDER', supabaseUrl);
  content = content.replace('SUPABASE_KEY_PLACEHOLDER', supabaseKey);

  fs.writeFileSync(targetPath, content, 'utf8');
  console.log(`Environment variables successfully injected into: ${targetPath}`);
} catch (error) {
  console.error('Error modifying environment file:', error);
  process.exit(1);
}

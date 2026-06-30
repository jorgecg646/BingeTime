const fs = require('fs');
const path = require('path');

// Paths for template and target files
const templatePath = path.join(__dirname, 'src', 'environments', 'environment.prod.template.ts');
const targetPath = path.join(__dirname, 'src', 'environments', 'environment.prod.ts');
const devTargetPath = path.join(__dirname, 'src', 'environments', 'environment.ts');
const devTemplatePath = path.join(__dirname, 'src', 'environments', 'environment.example.ts');

console.log('Running set-env.js to generate production environment file...');

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
    fs.writeFileSync(devTargetPath, `export const environment = { production: false, netlifyUrl: '' };\n`, 'utf8');
  }
}

// 2. Copy the prod template directly (no variable substitution needed anymore — DB connection is server-side only)
try {
  fs.copyFileSync(templatePath, targetPath);
  console.log(`Production environment file generated: ${targetPath}`);
} catch (error) {
  console.error('Error generating environment file:', error);
  process.exit(1);
}

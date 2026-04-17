const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
      if (dir.endsWith('.tsx') || dir.endsWith('.ts')) processFile(dir);
      return;
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function processFile(fullPath) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;
    
    // Remove resolveAvatarUrl from imports
    if (content.includes('resolveAvatarUrl')) {
      content = content.replace(/,\s*resolveAvatarUrl\s*/g, '');
      content = content.replace(/\{\s*resolveAvatarUrl\s*,\s*/g, '{ ');
      content = content.replace(/\{\s*resolveAvatarUrl\s*\}/g, '{ }');
      content = content.replace(/import\s*\{\s*\}\s*from\s*['"]@\/lib\/utils['"];?\n?/g, '');
      
      // Fix usage
      content = content.replace(/resolveAvatarUrl\(([^)]+)\)!/g, '$1');
      content = content.replace(/resolveAvatarUrl\(([^)]+)\)/g, '$1');
      
      // Specially remove the entire function from utils.ts
      if (fullPath.endsWith('utils.ts')) {
          content = content.replace(/export function resolveAvatarUrl[\s\S]*\}\n?/g, '');
      }

      changed = true;
    }
    
    if (changed) {
      fs.writeFileSync(fullPath, content);
      console.log('Fixed', fullPath);
    }
}

processDir('./src/app/(dashboard)');
processDir('./src/components');
processDir('./src/lib/utils.ts');

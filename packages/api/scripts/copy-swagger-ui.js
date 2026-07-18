const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  const swaggerUiDistPath = require.resolve('swagger-ui-dist');
  const swaggerUiDir = path.dirname(swaggerUiDistPath);
  const destDir = path.join(__dirname, '..', 'dist', 'swagger-ui');

  console.log(`Copying swagger-ui-dist from ${swaggerUiDir} to ${destDir}`);
  copyDir(swaggerUiDir, destDir);
  console.log('swagger-ui-dist copied successfully');
} catch (error) {
  console.warn('Warning: Could not copy swagger-ui-dist:', error.message);
  console.warn('Swagger UI may not work in production.');
}

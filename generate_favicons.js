const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Required favicon sizes to generate
const faviconSizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'icon-72x72.png', size: 72 },
  { name: 'icon-96x96.png', size: 96 },
  { name: 'icon-128x128.png', size: 128 },
  { name: 'icon-144x144.png', size: 144 }
];

// Source image path
const sourceImagePath = 'icons/icon-512.png';
const iconsDir = 'icons';

async function generateFavicons() {
  try {
    // Load the source image
    console.log('Loading source image:', sourceImagePath);
    const sourceImage = await loadImage(sourceImagePath);
    
    // Generate each favicon size
    for (const favicon of faviconSizes) {
      const { name, size } = favicon;
      
      // Create canvas
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      
      // Calculate scaling to maintain aspect ratio
      const scale = size / 512;
      
      // Draw scaled image
      ctx.drawImage(
        sourceImage,
        0, 0, 512, 512,  // Source rectangle
        0, 0, size, size   // Destination rectangle
      );
      
      // Save the image
      const outputPath = path.join(iconsDir, name);
      const buffer = canvas.toBuffer('image/png');
      
      fs.writeFileSync(outputPath, buffer);
      console.log(`Generated: ${name} (${size}x${size})`);
      
      // Get file size
      const stats = fs.statSync(outputPath);
      console.log(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);
    }
    
    console.log('\nAll favicons generated successfully!');
    
  } catch (error) {
    console.error('Error generating favicons:', error);
    process.exit(1);
  }
}

// Check if canvas is available
if (typeof createCanvas === 'undefined') {
  console.error('Canvas library is required. Install it with:');
  console.error('npm install canvas');
  process.exit(1);
}

generateFavicons();
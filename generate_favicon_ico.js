const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// ICO file structure constants
const ICO_HEADER_SIZE = 6;
const ICO_DIR_ENTRY_SIZE = 16;

// Required sizes for favicon.ico
const faviconSizes = [
  { size: 16 },
  { size: 32 }
];

// Source image path
const sourceImagePath = 'icons/icon-512.png';
const outputIcoPath = 'favicon.ico';

// ICO directory entry
class IcoDirEntry {
  constructor(width, height, colorCount, reserved, planes, bitsPerPixel, dataSize, offset) {
    this.width = width;
    this.height = height;
    this.colorCount = colorCount;
    this.reserved = reserved;
    this.planes = planes;
    this.bitsPerPixel = bitsPerPixel;
    this.dataSize = dataSize;
    this.offset = offset;
  }

  toBuffer() {
    const buffer = Buffer.alloc(ICO_DIR_ENTRY_SIZE);
    buffer.writeUInt8(this.width, 0);
    buffer.writeUInt8(this.height, 1);
    buffer.writeUInt8(this.colorCount, 2);
    buffer.writeUInt16LE(this.reserved, 3);
    buffer.writeUInt16LE(this.planes, 5);
    buffer.writeUInt16LE(this.bitsPerPixel, 7);
    buffer.writeUInt32LE(this.dataSize, 9);
    buffer.writeUInt32LE(this.offset, 13);
    return buffer;
  }
}

// Convert PNG buffer to ICO format
function pngToIco(pngBuffer, size) {
  return new Promise((resolve, reject) => {
    const png = require('pngjs').PNG.sync.read(pngBuffer);
    
    if (png.width !== size || png.height !== size) {
      reject(new Error(`PNG size must be ${size}x${size}`));
      return;
    }

    // Create ICO bitmap data
    const bitmapData = Buffer.alloc(size * size * 4);
    let offset = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (size * y + x) << 2;
        bitmapData[offset++] = png.data[idx];     // Blue
        bitmapData[offset++] = png.data[idx + 1]; // Green
        bitmapData[offset++] = png.data[idx + 2]; // Red
        bitmapData[offset++] = png.data[idx + 3]; // Alpha
      }
    }

    // Create XOR mask (for 32-bit images, this is empty)
    const xorMask = Buffer.alloc(0);
    
    // Create AND mask (for 32-bit images, this is empty)
    const andMask = Buffer.alloc(0);

    // Calculate total size
    const totalSize = ICO_HEADER_SIZE + ICO_DIR_ENTRY_SIZE + bitmapData.length + xorMask.length + andMask.length;

    // Create ICO data
    const icoData = Buffer.alloc(totalSize);
    let pos = 0;

    // ICO header
    icoData.writeUInt16LE(0, pos); pos += 2; // Reserved
    icoData.writeUInt16LE(1, pos); pos += 2; // Type (1 = ICO)
    icoData.writeUInt16LE(1, pos); pos += 2; // Image count

    // Directory entry offset
    const dirEntryOffset = ICO_HEADER_SIZE;
    const imageDataOffset = dirEntryOffset + ICO_DIR_ENTRY_SIZE;

    // Directory entry
    const dirEntry = new IcoDirEntry(
      size,
      size,
      0,
      0,
      1,
      32,
      bitmapData.length + xorMask.length + andMask.length,
      imageDataOffset
    );

    dirEntry.toBuffer().copy(icoData, pos);
    pos += ICO_DIR_ENTRY_SIZE;

    // Image data
    bitmapData.copy(icoData, pos);
    pos += bitmapData.length;
    xorMask.copy(icoData, pos);
    pos += xorMask.length;
    andMask.copy(icoData, pos);

    resolve(icoData);
  });
}

async function generateFaviconIco() {
  try {
    // Check if canvas is available
    if (typeof createCanvas === 'undefined') {
      console.error('Canvas library is required. Install it with:');
      console.error('npm install canvas');
      process.exit(1);
    }

    // Load the source image
    console.log('Loading source image:', sourceImagePath);
    const sourceImage = await loadImage(sourceImagePath);
    
    // Create canvas for each size
    const canvases = [];
    const pngBuffers = [];
    
    for (const favicon of faviconSizes) {
      const { size } = favicon;
      
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
      
      // Get PNG buffer
      const buffer = canvas.toBuffer('image/png');
      pngBuffers.push(buffer);
      
      console.log(`Generated ${size}x${size} PNG buffer`);
    }
    
    // Convert PNG buffers to ICO format
    console.log('Converting to ICO format...');
    const icoBuffers = await Promise.all(
      pngBuffers.map((buffer, index) => 
        pngToIco(buffer, faviconSizes[index].size)
      )
    );
    
    // Combine all ICO data
    let totalSize = ICO_HEADER_SIZE; // Header
    
    // Calculate directory entries size and total image data size
    for (const icoData of icoBuffers) {
      const dirEntrySize = ICO_DIR_ENTRY_SIZE;
      const imageDataSize = icoData.length - (ICO_HEADER_SIZE + dirEntrySize);
      totalSize += dirEntrySize + imageDataSize;
    }
    
    // Create final ICO buffer
    const finalIco = Buffer.alloc(totalSize);
    let pos = 0;
    
    // ICO header
    finalIco.writeUInt16LE(0, pos); pos += 2; // Reserved
    finalIco.writeUInt16LE(1, pos); pos += 2; // Type (1 = ICO)
    finalIco.writeUInt16LE(icoBuffers.length, pos); pos += 2; // Image count
    
    // Store directory entry offsets
    const dirEntryOffsets = [];
    let imageDataPos = ICO_HEADER_SIZE + (ICO_DIR_ENTRY_SIZE * icoBuffers.length);
    
    // Write directory entries
    for (let i = 0; i < icoBuffers.length; i++) {
      const icoData = icoBuffers[i];
      const dirEntrySize = ICO_DIR_ENTRY_SIZE;
      const imageDataSize = icoData.length - (ICO_HEADER_SIZE + dirEntrySize);
      
      // Create directory entry
      const dirEntry = new IcoDirEntry(
        faviconSizes[i].size,
        faviconSizes[i].size,
        0,
        0,
        1,
        32,
        imageDataSize,
        imageDataPos
      );
      
      dirEntry.toBuffer().copy(finalIco, pos);
      pos += dirEntrySize;
      
      dirEntryOffsets.push(imageDataPos);
      imageDataPos += imageDataSize;
    }
    
    // Write image data
    for (let i = 0; i < icoBuffers.length; i++) {
      const icoData = icoBuffers[i];
      const imageDataSize = icoData.length - (ICO_HEADER_SIZE + ICO_DIR_ENTRY_SIZE);
      icoData.copy(finalIco, dirEntryOffsets[i], ICO_HEADER_SIZE + ICO_DIR_ENTRY_SIZE);
    }
    
    // Write the ICO file
    fs.writeFileSync(outputIcoPath, finalIco);
    
    // Get file size
    const stats = fs.statSync(outputIcoPath);
    const fileSize = stats.size;
    
    console.log(`\n✓ Generated: favicon.ico`);
    console.log(`  File size: ${(fileSize / 1024).toFixed(2)} KB`);
    console.log(`  Sizes included: ${faviconSizes.map(f => f.size + '×' + f.size).join(', ')}`);
    
    // Verify the file was created
    if (fs.existsSync(outputIcoPath)) {
      console.log(`\n✓ favicon.ico successfully created in project root directory!`);
    } else {
      console.error(`\n✗ Error: favicon.ico was not created`);
    }
    
  } catch (error) {
    console.error('Error generating favicon.ico:', error);
    process.exit(1);
  }
}

// Check if required dependencies are available
try {
  require('pngjs');
} catch (error) {
  console.error('PNG.js library is required. Install it with:');
  console.error('npm install pngjs');
  process.exit(1);
}

generateFaviconIco();
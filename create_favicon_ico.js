const fs = require('fs');
const path = require('path');

// ICO file structure constants
const ICO_HEADER_SIZE = 6;
const ICO_DIR_ENTRY_SIZE = 16;

// Required sizes for favicon.ico
const faviconSizes = [
  { size: 16, file: 'icons/favicon-16x16.png' },
  { size: 32, file: 'icons/favicon-32x32.png' }
];

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

// Simple ICO file creator
function createIcoFile() {
  try {
    console.log('Creating favicon.ico from existing PNG files...');
    
    // Read all PNG files
    const pngBuffers = [];
    for (const favicon of faviconSizes) {
      if (!fs.existsSync(favicon.file)) {
        throw new Error(`File not found: ${favicon.file}`);
      }
      const buffer = fs.readFileSync(favicon.file);
      pngBuffers.push(buffer);
      console.log(`✓ Loaded: ${favicon.file}`);
    }
    
    // Calculate total ICO file size
    let totalSize = ICO_HEADER_SIZE; // Header
    totalSize += ICO_DIR_ENTRY_SIZE * faviconSizes.length; // Directory entries
    
    // Add PNG data sizes (assuming they'll be used as-is)
    for (const buffer of pngBuffers) {
      totalSize += buffer.length;
    }
    
    // Create ICO buffer
    const icoBuffer = Buffer.alloc(totalSize);
    let pos = 0;
    
    // ICO header
    icoBuffer.writeUInt16LE(0, pos); pos += 2; // Reserved
    icoBuffer.writeUInt16LE(1, pos); pos += 2; // Type (1 = ICO)
    icoBuffer.writeUInt16LE(faviconSizes.length, pos); pos += 2; // Image count
    
    // Store directory entry offsets
    const dirEntryOffsets = [];
    let imageDataPos = ICO_HEADER_SIZE + (ICO_DIR_ENTRY_SIZE * faviconSizes.length);
    
    // Write directory entries
    for (let i = 0; i < faviconSizes.length; i++) {
      const favicon = faviconSizes[i];
      const pngBuffer = pngBuffers[i];
      
      // For simplicity, use PNG data size as image data size
      const imageDataSize = pngBuffer.length;
      
      // Create directory entry
      const dirEntry = new IcoDirEntry(
        favicon.size,
        favicon.size,
        0,
        0,
        1,
        32,
        imageDataSize,
        imageDataPos
      );
      
      dirEntry.toBuffer().copy(icoBuffer, pos);
      pos += ICO_DIR_ENTRY_SIZE;
      
      dirEntryOffsets.push(imageDataPos);
      imageDataPos += imageDataSize;
    }
    
    // Write image data (PNG data)
    for (let i = 0; i < pngBuffers.length; i++) {
      pngBuffers[i].copy(icoBuffer, dirEntryOffsets[i]);
    }
    
    // Write the ICO file
    const outputIcoPath = 'favicon.ico';
    fs.writeFileSync(outputIcoPath, icoBuffer);
    
    // Get file size
    const stats = fs.statSync(outputIcoPath);
    const fileSize = stats.size;
    
    console.log(`\n✓ Generated: favicon.ico`);
    console.log(`  File size: ${(fileSize / 1024).toFixed(2)} KB`);
    console.log(`  Sizes included: ${faviconSizes.map(f => f.size + '×' + f.size).join(', ')}`);
    
    // Verify the file was created
    if (fs.existsSync(outputIcoPath)) {
      console.log(`\n✓ favicon.ico successfully created in project root directory!`);
      console.log(`  The file contains ${faviconSizes.length} icon sizes for comprehensive browser compatibility.`);
    } else {
      console.error(`\n✗ Error: favicon.ico was not created`);
    }
    
  } catch (error) {
    console.error('Error creating favicon.ico:', error);
    process.exit(1);
  }
}

createIcoFile();
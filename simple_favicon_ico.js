const fs = require('fs');

// Simple ICO file creator using direct buffer manipulation
function createIcoFile() {
  try {
    console.log('Creating favicon.ico from existing PNG files...');
    
    // Read the PNG files
    const png16 = fs.readFileSync('icons/favicon-16x16.png');
    const png32 = fs.readFileSync('icons/favicon-32x32.png');
    
    console.log(`✓ Loaded: icons/favicon-16x16.png (${png16.length} bytes)`);
    console.log(`✓ Loaded: icons/favicon-32x32.png (${png32.length} bytes)`);
    
    // Calculate ICO file size
    const headerSize = 6; // 2 + 2 + 2
    const dirEntrySize = 16; // 16 bytes per directory entry
    const totalSize = headerSize + (dirEntrySize * 2) + png16.length + png32.length;
    
    console.log(`Total ICO file size: ${totalSize} bytes`);
    
    // Create ICO buffer
    const icoBuffer = Buffer.alloc(totalSize);
    let pos = 0;
    
    // ICO header: Reserved(2) + Type(2) + Count(2)
    icoBuffer.writeUInt16LE(0, pos); pos += 2; // Reserved
    icoBuffer.writeUInt16LE(1, pos); pos += 2; // Type (1 = ICO)
    icoBuffer.writeUInt16LE(2, pos); pos += 2; // Image count (2 images)
    
    // First directory entry (16x16)
    icoBuffer.writeUInt8(16, pos); pos += 1; // Width
    icoBuffer.writeUInt8(16, pos); pos += 1; // Height  
    icoBuffer.writeUInt8(0, pos); pos += 1; // Color count
    icoBuffer.writeUInt16LE(0, pos); pos += 2; // Reserved
    icoBuffer.writeUInt16LE(1, pos); pos += 2; // Color planes
    icoBuffer.writeUInt16LE(32, pos); pos += 2; // Bits per pixel
    icoBuffer.writeUInt32LE(png16.length, pos); pos += 4; // Data size
    icoBuffer.writeUInt32LE(headerSize + dirEntrySize * 2, pos); pos += 4; // Offset
    
    // Second directory entry (32x32)
    icoBuffer.writeUInt8(32, pos); pos += 1; // Width
    icoBuffer.writeUInt8(32, pos); pos += 1; // Height
    icoBuffer.writeUInt8(0, pos); pos += 1; // Color count
    icoBuffer.writeUInt16LE(0, pos); pos += 2; // Reserved
    icoBuffer.writeUInt16LE(1, pos); pos += 2; // Color planes
    icoBuffer.writeUInt16LE(32, pos); pos += 2; // Bits per pixel
    icoBuffer.writeUInt32LE(png32.length, pos); pos += 4; // Data size
    icoBuffer.writeUInt32LE(headerSize + dirEntrySize * 2 + png16.length, pos); pos += 4; // Offset
    
    // Write PNG data
    png16.copy(icoBuffer, pos);
    pos += png16.length;
    png32.copy(icoBuffer, pos);
    
    // Write the ICO file
    const outputIcoPath = 'favicon.ico';
    fs.writeFileSync(outputIcoPath, icoBuffer);
    
    // Get file size
    const stats = fs.statSync(outputIcoPath);
    const fileSize = stats.size;
    
    console.log(`\n✓ Generated: favicon.ico`);
    console.log(`  File size: ${(fileSize / 1024).toFixed(2)} KB`);
    console.log(`  Sizes included: 16×16, 32×32`);
    
    // Verify the file was created
    if (fs.existsSync(outputIcoPath)) {
      console.log(`\n✓ favicon.ico successfully created in project root directory!`);
      console.log(`  The file contains 2 icon sizes for comprehensive browser compatibility.`);
      console.log(`  This provides legacy browser support and automatic discovery by browsers.`);
    } else {
      console.error(`\n✗ Error: favicon.ico was not created`);
    }
    
  } catch (error) {
    console.error('Error creating favicon.ico:', error);
    process.exit(1);
  }
}

createIcoFile();
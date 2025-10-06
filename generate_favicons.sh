#!/bin/bash

# Source image
SOURCE_IMAGE="icons/icon-512.png"
ICONS_DIR="icons"

# Required favicon sizes to generate
SIZES=(
    "16:favicon-16x16.png"
    "32:favicon-32x32.png"
    "72:icon-72x72.png"
    "96:icon-96x96.png"
    "128:icon-128x128.png"
    "144:icon-144x144.png"
)

echo "Generating favicon sizes from $SOURCE_IMAGE..."

# Generate each favicon size
for size_pair in "${SIZES[@]}"; do
    IFS=':' read -r size filename <<< "$size_pair"
    
    output_path="$ICONS_DIR/$filename"
    
    echo "Generating: $filename ($size x $size)"
    
    # Use sips to resize the image
    sips -z "$size" "$size" "$SOURCE_IMAGE" --out "$output_path" >/dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        # Get file size
        file_size=$(stat -f%z "$output_path" 2>/dev/null || stat -c%s "$output_path" 2>/dev/null)
        file_size_kb=$(echo "scale=2; $file_size / 1024" | bc)
        echo "  ✓ Generated: $filename (${file_size_kb} KB)"
    else
        echo "  ✗ Failed to generate: $filename"
    fi
done

echo ""
echo "All favicon generation completed!"
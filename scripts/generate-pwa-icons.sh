#!/bin/bash

# Script to generate PWA icons from SVG source using rsvg-convert
# Usage: ./scripts/generate-pwa-icons.sh

cd "$(dirname "$0")/../public/images"

SVG_SOURCE="icon.svg"
SIZES=(72 96 128 144 152 192 384 512)

echo "Generating PWA icons from $SVG_SOURCE..."
echo ""

# Generate standard icons
for size in "${SIZES[@]}"; do
    echo "Creating ${size}x${size} icon..."
    rsvg-convert -w "$size" -h "$size" "$SVG_SOURCE" -o "icon-${size}x${size}.png"
done

# Generate maskable icons (with padding for safe zone)
echo ""
echo "Creating maskable icons..."
for size in 192 512; do
    echo "Creating ${size}x${size} maskable icon..."
    # Add 10% padding on all sides for safe zone
    padding=$((size / 10))
    inner=$((size - 2 * padding))
    rsvg-convert -w "$inner" -h "$inner" "$SVG_SOURCE" | magick - -background "#071024" \
        -gravity center -extent "${size}x${size}" \
        "icon-${size}x${size}-maskable.png"
done

# Generate favicon
echo ""
echo "Creating favicon..."
rsvg-convert -w 32 -h 32 "$SVG_SOURCE" -o "../favicon.png"

echo ""
echo "✓ Icon generation complete!"
echo ""
echo "Generated files:"
ls -lh icon-*.png ../favicon.png 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

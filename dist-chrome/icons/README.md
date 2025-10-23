# Extension Icons

Please add the following icon files:

- `icon16.png` - 16x16px (toolbar icon)
- `icon48.png` - 48x48px (extension management page)
- `icon128.png` - 128x128px (Chrome Web Store)

## Requirements

- PNG format
- Transparent background recommended
- Should be the Guardflow shield logo
- Square aspect ratio

## Quick Generate

You can use the Guardflow logo and resize it:

```bash
# Example with ImageMagick
convert logo.png -resize 16x16 icon16.png
convert logo.png -resize 48x48 icon48.png
convert logo.png -resize 128x128 icon128.png
```

Or use an online tool like:
- https://www.favicon-generator.org/
- https://realfavicongenerator.net/

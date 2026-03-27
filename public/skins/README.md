# Tank Skins

This folder contains custom tank skin images. Each skin should be a square PNG image (recommended: 128x128 or 256x256 pixels).

## Adding a New Skin

1. Place your PNG image in this folder (e.g., `tank1.png`)
2. Edit `/client/skins.js` and add your skin to the `AVAILABLE_SKINS` array:

```javascript
{ id: 'tank1', name: 'Tank 1', path: '/skins/tank1.png' },
```

## Skin Image Guidelines

- **Format**: PNG with transparency
- **Size**: 128x128 or 256x256 pixels (square)
- **Background**: Transparent (RGBA)
- **Design**: Tank/military themed, works at various sizes

## Example

```javascript
const AVAILABLE_SKINS = [
  { id: 'default', name: 'Default', path: null },
  { id: 'tank1', name: 'Red Tank', path: '/skins/tank1.png' },
  { id: 'tank2', name: 'Blue Tank', path: '/skins/tank2.png' },
  { id: 'custom', name: 'Custom Skin', path: '/skins/custom.png' },
];
```

Players will see these skins in the skin selector on the start menu.

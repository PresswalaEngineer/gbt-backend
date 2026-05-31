// Target dimensions per image field. The admin sends a `preset` name; the BE
// resizes to these and converts to WebP. `cover` = exact dims (centre/smart
// crop); `inside` = fit within (preserve whole image, no crop).
export const IMAGE_PRESETS = {
    banner: { width: 1600, height: 600, fit: 'cover' },
    'tour-thumbnail': { width: 800, height: 600, fit: 'cover' },
    'attraction-thumbnail': { width: 800, height: 600, fit: 'cover' },
    'attraction-offer': { width: 1200, height: 800, fit: 'cover' },
    'blog-featured': { width: 1600, height: 900, fit: 'cover' },
    'blog-thumbnail': { width: 800, height: 600, fit: 'cover' },
    og: { width: 1200, height: 630, fit: 'cover' },
    gallery: { width: 1600, height: 1200, fit: 'cover' },
    'route-map': { width: 1600, fit: 'inside' },
};

// Used when no/unknown preset is sent — fit within 1600px, never crop.
export const DEFAULT_IMAGE_PRESET = { width: 1600, fit: 'inside' };

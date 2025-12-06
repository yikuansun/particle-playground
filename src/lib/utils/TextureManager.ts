export class TextureManager {
    private images: Record<string, HTMLImageElement> = {};
    private cache: Record<string, HTMLCanvasElement | OffscreenCanvas> = {};
    
    // Load all your base textures here
    async loadTextures(urls: Record<string, string>) {
        const promises = Object.entries(urls).map(([name, url]) => {
            return new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.src = url;
                img.onload = () => {
                    this.images[name] = img;
                    resolve();
                };
                img.onerror = reject;
            });
        });
        await Promise.all(promises);
    }

    /**
     * Returns a canvas containing the texture tinted with the specific color.
     * Uses memoization to ensure performance.
     */
    getTintedTexture(textureName: string, color: string): HTMLCanvasElement | OffscreenCanvas | null {
        // 1. Check if base image exists
        const img = this.images[textureName];
        if (!img) return null;

        // 2. Check Cache
        const cacheKey = `${textureName}-${color}`;
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        // 3. Create new tinted texture
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        // Use OffscreenCanvas if available (faster/worker friendly), else standard Canvas
        const canvas = typeof OffscreenCanvas !== 'undefined' 
            ? new OffscreenCanvas(width, height) 
            : document.createElement('canvas');
            
        if (canvas instanceof HTMLCanvasElement) {
            canvas.width = width;
            canvas.height = height;
        }

        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

        // A. Draw the white texture
        ctx.drawImage(img, 0, 0);

        // B. Set Composite Mode to "source-in"
        // This keeps the *existing* alpha (the sprite shape) 
        // but replaces the color with whatever we draw next.
        ctx.globalCompositeOperation = 'source-in';

        // C. Draw the Color
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);

        // D. Reset (Important for next use, though here we are done)
        ctx.globalCompositeOperation = 'source-over';

        // 4. Save to cache
        this.cache[cacheKey] = canvas;

        return canvas;
    }
}

// Singleton instance
export const textureManager = new TextureManager();
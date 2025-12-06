export class TextureManager {
    private images: Record<string, HTMLImageElement> = {};
    private cache: Record<string, HTMLCanvasElement | OffscreenCanvas> = {};
    private loadingPromises: Record<string, Promise<void>> = {}; // Track active loads
    
    /**
     * Loads a single texture dynamically.
     * Safe to call multiple times; will only fetch once.
     */
    async loadTexture(name: string, url: string): Promise<void> {
        // 1. If already loaded, do nothing
        if (this.images[name]) return;

        // 2. If currently loading, return the existing promise
        if (this.loadingPromises[name]) {
            return this.loadingPromises[name];
        }

        // 3. Start loading
        const promise = new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Good practice for WebGL/Canvas
            img.src = url;
            img.onload = () => {
                this.images[name] = img;
                delete this.loadingPromises[name]; // Cleanup
                resolve();
            };
            img.onerror = (err) => {
                delete this.loadingPromises[name];
                console.error(`Failed to load texture: ${name}`, err);
                reject(err);
            };
        });

        this.loadingPromises[name] = promise;
        return promise;
    }

    // Bulk loader (wraps loadTexture)
    async loadTextures(urls: Record<string, string>) {
        const promises = Object.entries(urls).map(([name, url]) => 
            this.loadTexture(name, url)
        );
        await Promise.all(promises);
    }

    /**
     * Returns a canvas containing the texture tinted with the specific color.
     * Returns null if the texture is not yet loaded.
     */
    getTintedTexture(textureName: string, color: string): HTMLCanvasElement | OffscreenCanvas | null {
        // 1. Check if base image exists
        const img = this.images[textureName];
        if (!img) return null; // Gracefully handle not-yet-loaded textures

        // 2. Check Cache
        const cacheKey = `${textureName}-${color}`;
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        // 3. Create new tinted texture
        const width = img.naturalWidth;
        const height = img.naturalHeight;

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
        ctx.globalCompositeOperation = 'source-in';

        // C. Draw the Color
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);

        // D. Reset
        ctx.globalCompositeOperation = 'source-over';

        // 4. Save to cache
        this.cache[cacheKey] = canvas;

        return canvas;
    }
}

export const textureManager = new TextureManager();
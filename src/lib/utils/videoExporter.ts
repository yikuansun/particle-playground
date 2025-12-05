import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { Frame } from '$lib/types';

interface VideoSettings {
    width: number;
    height: number;
    fps: number;
}

export async function exportToMp4(frames: Frame[], drawFrame: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, frame: Frame) => void, settings: VideoSettings) {
    const { width, height, fps } = settings;

    // 1. Setup the Muxer (The container builder)
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: 'avc', // H.264
            width,
            height
        },
        firstTimestampBehavior: 'offset', // Ensures video starts at 0s
        fastStart: false,
    });

    // 2. Setup the Encoder (The image compressor)
    const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error(e)
    });

    // Configure for H.264 (AVC)
    videoEncoder.configure({
        codec: 'avc1.42001f', // Baseline Profile (widely supported)
        width,
        height,
        bitrate: 2_000_000, // 2 Mbps
        framerate: fps
    });

    // 3. Create a canvas to draw our frames on
    // We use OffscreenCanvas for better performance, falling back to standard if needed
    const canvas = typeof OffscreenCanvas !== 'undefined' 
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');
    
    if (canvas instanceof HTMLCanvasElement) {
        canvas.width = width;
        canvas.height = height;
    }

    const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

    // 4. Loop through all frames and encode
    const frameDurationMicro = 1_000_000 / fps;

    for (let i = 0; i < frames.length; i++) {
        // A. Draw the frame logic
        drawFrame(ctx, frames[i]);

        // B. Create a VideoFrame from the canvas
        // Timestamp must be in microseconds
        const videoFrame = new VideoFrame(canvas, { 
            timestamp: i * frameDurationMicro 
        });

        // C. Encode it
        // keyFrame: true forces a full image (I-frame) every 2 seconds for seekability
        videoEncoder.encode(videoFrame, { keyFrame: i % (fps * 2) === 0 });
        
        // D. Cleanup immediately to save GPU memory
        videoFrame.close();
    }

    // 5. Finish up
    await videoEncoder.flush();
    muxer.finalize();

    // 6. Create Download Blob
    const buffer = muxer.target.buffer;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `particle_simulation_${Date.now()}.mp4`;
    a.click();
    
    URL.revokeObjectURL(url);
}
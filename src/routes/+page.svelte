<script lang="ts">
    import { onMount, untrack } from "svelte";
    import type { Particle, Emitter, Frame, ParticleLifetimeSettings, CurveLut } from "$lib/types";
    import { Canvas, Layer } from "svelte-canvas";
    import Srand, { type SrandInstance } from "seeded-rand";
	import CurveEditor from "$lib/components/CurveEditor.svelte";
    import Modal from "$lib/components/Modal.svelte";
    import { exportToMp4 } from "$lib/utils/videoExporter"
    import { textureManager } from "$lib/utils/TextureManager";

    let emitters: Emitter[] = $state([{
        shape: {
            type: 'point',
            x: 400,
            y: 300,
        },
        emissionRate: 10,
        particlesPerEmission: {
            value: 10,
            variability: 10,
        },
        particleParams: {
            radius: {
                value: 10,
                variability: 0,
            },
            rotation: {
                value: 0,
                variability: 360,
            },
            speed: {
                value: 200,
                variability: 80,
            },
            lifespan: {
                value: 0.8,
                variability: 0.5,
            },
            color: "#FFFFFF",
            lifetimeSettings: {
                opacityCurve: new Float32Array((new Array(100)).fill(0).map((_, i) => 1 - i/100)),
                speedCurve: new Float32Array((new Array(100)).fill(1)),
                radiusCurve: new Float32Array((new Array(100)).fill(0).map((_, i) => 1 - i/100)),
            },
            texture: "default",
        },
    }]);

    let videoSettings = $state({
        width: 800,
        height: 600,
        fps: 30,
        duration: 10,
    });

    function getNextFrame(index: number, lastFrame: Frame, rng: SrandInstance) {
        let frame: Frame = { index, particles: [] };

        for (let emitter of emitters) {
            if (index % Math.max(Math.floor(videoSettings.fps / emitter.emissionRate), 1) === 0) {
                // emit new particles
                let count = emitter.particlesPerEmission.value + rng.intInRange(-emitter.particlesPerEmission.variability, emitter.particlesPerEmission.variability);
                for (let i = 0; i < count; i++) {
                    let particle: Particle = {
                        x: emitter.shape.x,
                        y: emitter.shape.y,
                        radius: emitter.particleParams.radius.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.radius.variability,
                        rotation: emitter.particleParams.rotation.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.rotation.variability,
                        speed: emitter.particleParams.speed.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.speed.variability,
                        lifespan: emitter.particleParams.lifespan.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.lifespan.variability,
                        health: 1,
                        color: emitter.particleParams.color,
                        opacity: emitter.particleParams.lifetimeSettings.opacityCurve[0],
                        lifetimeSettings: emitter.particleParams.lifetimeSettings,
                        texture: emitter.particleParams.texture,
                    }
                    frame.particles.push(particle);
                }
            }
        }

        // copy particles from last frame
        for (let particle of lastFrame.particles) {
            let copy: Particle = Object.assign({}, particle);

            let normalizedLife = Math.max(0, Math.min(1, 1 - copy.health));
            const lutIndex = Math.floor(normalizedLife * (particle.lifetimeSettings.opacityCurve.length - 1));

            let currentSpeed = particle.speed * particle.lifetimeSettings.speedCurve[lutIndex];
            copy.x += currentSpeed / videoSettings.fps * Math.cos(particle.rotation * Math.PI / 180);
            copy.y += currentSpeed / videoSettings.fps * Math.sin(particle.rotation * Math.PI / 180);
            copy.health -= 1 / (copy.lifespan * videoSettings.fps);
            
            copy.opacity = Math.max(0, Math.min(1, particle.lifetimeSettings.opacityCurve[lutIndex]));

            if (copy.health > 0) frame.particles.push(copy);
        }

        // remove dead particles
        frame.particles = frame.particles.filter(p => p.health > 0);

        return frame;
    }

    let frames: Frame[] = $state([]);
    function createAnimationFrames() {
        let rng = new Srand(69);

        frames[0] = getNextFrame(0, { index: 0, particles: [] }, rng);
        for (let i = 1; i < videoSettings.duration * videoSettings.fps; i++) {
            frames[i] = getNextFrame(i, frames[i - 1], rng);
        }
    }

    let selectedFrame = $state(0);

    let videoPlaying = $state(false);
    function playVideo() {
        if (videoPlaying) {
            setTimeout(playVideo, 1000 / videoSettings.fps);
        }

        selectedFrame = (selectedFrame + 1) % (videoSettings.duration * videoSettings.fps);
    }

    function drawFrame(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, frame: Frame, bg: string="black") {
        if (bg === "transparent") ctx.clearRect(0, 0, videoSettings.width, videoSettings.height);
        else {
            ctx.save();
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, videoSettings.width, videoSettings.height);
            ctx.restore();
        }
        for (let particle of frame.particles) {
            ctx.save();
            ctx.globalAlpha = particle.opacity;
            if (particle.texture === "default") {
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, 2 * Math.PI);
                ctx.fill();
            }
            else {
                const texture = textureManager.getTintedTexture(particle.texture, particle.color);
                ctx.drawImage(texture as CanvasImageSource, particle.x - particle.radius, particle.y - particle.radius, particle.radius * 2, particle.radius * 2);
            }
            ctx.restore();
        }
    }
    
    let exportModalOpen = $state(false);
    let isExporting = $state(false);

    async function handleExport() {
        if (isExporting) return;
        isExporting = true;
        try {
            // We pass the raw data frames and settings
            await exportToMp4(frames, drawFrame, videoSettings);
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed. Please check console.");
        } finally {
            isExporting = false;
        }
    }

    let settingsModalOpen = $state(false);

    onMount(async () => {
        await textureManager.loadTextures({
            smoke: (await import("$lib/assets/textures/smoke.png")).default,
        });

        createAnimationFrames();
    });
</script>

<svelte:window onkeydown={(e) => {
    if (document.activeElement?.tagName === "INPUT") return;
    if (e.key === " ") {
        if (!videoPlaying) {
            videoPlaying = true;
            playVideo();
        }
        else {
            videoPlaying = false;
        }
    }
}} />

<div class="flex flex-col w-full h-full gap-5 p-5 box-border">
    <div class="flex flex-row gap-5">
        <span class="font-bold">Particle Playground</span>
        <button onclick={() => {
            exportModalOpen = true;
        }}>Export</button>
        <button onclick={() => {
            settingsModalOpen = true;
        }}>Project Settings</button>
    </div>
    <div class="grow flex flex-row gap-4 min-h-0">
        <div class="grow flex justify-center items-center">
            <Canvas width={videoSettings.width} height={videoSettings.height} class="w-full! h-full! object-contain">
                <Layer render={({ context: ctx }) => {
                    if (frames[selectedFrame]) {
                        drawFrame(ctx, frames[selectedFrame]);
                    }
                }} />
            </Canvas>
        </div>
        <div class="w-100 overflow-y-scroll pr-3">
            <b>Emitters</b>
            {#each emitters as emitter}
                <div>
                    <b>Emitter Properties</b>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Position</span></span>
                        <span><span class="align-middle">x:</span></span>
                        <input type="number" bind:value={emitter.shape.x} onchange={createAnimationFrames} min={0} max={videoSettings.width} class="number-input" />
                        <span class="pl-1.5"><span class="align-middle">y:</span></span>
                        <input type="number" bind:value={emitter.shape.y} onchange={createAnimationFrames} min={0} max={videoSettings.height} class="number-input" />
                    </div>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Emissions per second</span></span>
                        <input type="number" bind:value={emitter.emissionRate} onchange={createAnimationFrames} min={0.5} max={10} step={0.1} class="number-input" />
                    </div>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Particles per emission</span></span>
                        <input type="number" bind:value={emitter.particlesPerEmission.value} onchange={createAnimationFrames} min={0} max={100} step={1} class="number-input" />
                        <span><span class="align-middle">±</span></span>
                        <input type="number" bind:value={emitter.particlesPerEmission.variability} onchange={createAnimationFrames} min={0} max={100} step={1} class="number-input" />
                    </div>
                    <b>Default particle parameters</b>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Radius</span></span>
                        <input type="number" bind:value={emitter.particleParams.radius.value} onchange={createAnimationFrames} min={0} max={100} step={1} class="number-input" />
                        <span><span class="align-middle">±</span></span>
                        <input type="number" bind:value={emitter.particleParams.radius.variability} onchange={createAnimationFrames} min={0} max={100} step={1} class="number-input" />
                    </div>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Rotation</span></span>
                        <input type="number" bind:value={emitter.particleParams.rotation.value} onchange={createAnimationFrames} min={0} max={360} step={1} class="number-input" />
                        <span><span class="align-middle">±</span></span>
                        <input type="number" bind:value={emitter.particleParams.rotation.variability} onchange={createAnimationFrames} min={0} max={360} step={1} class="number-input" />
                    </div>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Speed</span></span>
                        <input type="number" bind:value={emitter.particleParams.speed.value} onchange={createAnimationFrames} min={0} max={1000} step={1} class="number-input" />
                        <span><span class="align-middle">±</span></span>
                        <input type="number" bind:value={emitter.particleParams.speed.variability} onchange={createAnimationFrames} min={0} max={1000} step={1} class="number-input" />
                    </div>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Lifespan</span></span>
                        <input type="number" bind:value={emitter.particleParams.lifespan.value} onchange={createAnimationFrames} min={0} max={10} step={0.1} class="number-input" />
                        <span><span class="align-middle">±</span></span>
                        <input type="number" bind:value={emitter.particleParams.lifespan.variability} onchange={createAnimationFrames} min={0} max={10} step={0.1} class="number-input" />
                    </div>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Color</span></span>
                        <input type="color" bind:value={emitter.particleParams.color} onchange={createAnimationFrames} />
                    </div>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Texture</span></span>
                        <select bind:value={emitter.particleParams.texture} onchange={createAnimationFrames}>
                            <option value="default">Default</option>
                            <option value="smoke">Smoke</option>
                        </select>
                    </div>
                    <b>Particle Lifetime Settings</b>
                    <div>
                        <span>Opacity curve</span>
                        <CurveEditor bind:value={emitter.particleParams.lifetimeSettings.opacityCurve} onchange={createAnimationFrames}></CurveEditor>
                    </div>
                    <div>
                        <span>Speed over time</span>
                        <CurveEditor
                            bind:value={emitter.particleParams.lifetimeSettings.speedCurve}
                            defaultPoints={[
                                { x: 0, y: 1 },
                                { x: 1, y: 1 }
                            ]}
                            onchange={createAnimationFrames} />
                    </div>
                </div>
            {/each}
        </div>
    </div>
    <div class="flex flex-row gap-4">
        <button onclick={() => {
            selectedFrame--;
            if (selectedFrame < 0) selectedFrame = videoSettings.duration * videoSettings.fps - 1;
        }}>
            <span class="icon icon-20 icon-filled align-middle">skip_previous</span>
        </button>
        <label>
            <input type="checkbox" bind:checked={videoPlaying} onchange={playVideo} class="hidden" />
            <span class="icon icon-20 icon-filled align-middle">
                {#if videoPlaying} pause {:else} play_arrow {/if}
            </span>
        </label>
        <button onclick={() => {
            selectedFrame++;
            if (selectedFrame >= videoSettings.duration * videoSettings.fps) selectedFrame = 0;
        }}>
            <span class="icon icon-20 icon-filled align-middle">skip_next</span>    
        </button>
        <span class="grow">
            <input type="range" min={0} max={videoSettings.duration * videoSettings.fps - 1} bind:value={selectedFrame}
                class="w-full progress-bar align-middle" />
        </span>
    </div>
</div>

<Modal bind:open={exportModalOpen} title="Export">
    <button 
        onclick={handleExport} 
        disabled={isExporting}
        class="btn"
    >
        {isExporting ? 'Rendering...' : 'Export MP4'}
    </button>
</Modal>

<Modal bind:open={settingsModalOpen} title="Project Settings">
    <div class="flex flex-col gap-2">
        <div class="flex flex-row gap-2">
            <span class="grow"><span class="align-middle">Width</span></span>
            <input type="number" bind:value={videoSettings.width} class="number-input" onchange={createAnimationFrames} />
        </div>
        <div class="flex flex-row gap-2">
            <span class="grow"><span class="align-middle">Height</span></span>
            <input type="number" bind:value={videoSettings.height} class="number-input" onchange={createAnimationFrames} />
        </div>
        <div class="flex flex-row gap-2">
            <span class="grow"><span class="align-middle">FPS</span></span>
            <input type="number" bind:value={videoSettings.fps} class="number-input" onchange={createAnimationFrames} />
        </div>
        <div class="flex flex-row gap-2">
            <span class="grow"><span class="align-middle">Duration</span></span>
            <input type="number" bind:value={videoSettings.duration} class="number-input" onchange={createAnimationFrames} />
        </div>
    </div>
</Modal>

<style>
    :global(body) {
        margin: 0;
        width: 100vw;
        height: 100vh;
    }
</style>
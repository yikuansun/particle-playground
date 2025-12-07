<!-- this is the main page of the application. The bulk of the code is in this file. -->

<script lang="ts">
    import { onMount, untrack } from "svelte";
    import type { Particle, Emitter, Frame, ParticleLifetimeSettings, CurveLut } from "$lib/types";
    import { Canvas, Layer } from "svelte-canvas";
    import Srand, { type SrandInstance } from "seeded-rand";
	import CurveEditor from "$lib/components/CurveEditor.svelte";
    import Modal from "$lib/components/Modal.svelte";
    import { exportToMp4 } from "$lib/utils/videoExporter"
    import { textureManager } from "$lib/utils/TextureManager";

    // Save URL of each texture. Textures are loaded dynamically through TextureManager.
    let textureUrls: Record<string, string> = {};
    (async () => {
        textureUrls["smoke"] = (await import("$lib/assets/textures/smoke.png")).default;
        textureUrls["dot"] = (await import("$lib/assets/textures/dot.png")).default;
        textureUrls["circle_test"] = (await import("$lib/assets/textures/circle-test.png")).default;
        textureUrls["energy"] = (await import("$lib/assets/textures/energy.png")).default;
    })();

    // emitter parameters
    let emitters: Emitter[] = $state([{
        shape: {
            type: 'point',
            x: 480,
            y: 270,
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
            direction: {
                value: 0,
                variability: 360,
            },
            rotation: {
                value: 0,
                variability: 0,
            },
            speed: {
                value: 200,
                variability: 80,
            },
            lifespan: {
                value: 0.8,
                variability: 0.5,
            },
            color: "#ffffff",
            lifetimeSettings: {
                opacityCurve: new Float32Array((new Array(100)).fill(0).map((_, i) => 1 - i/100)),
                opacityCurvePoints: [{ x: 0, y: 1, id: 0 }, { x: 1, y: 0, id: 1 }],
                speedCurve: new Float32Array((new Array(100)).fill(1)),
                speedCurvePoints: [{ x: 0, y: 1, id: 0 }, { x: 1, y: 1, id: 1 }],
                radiusCurve: new Float32Array((new Array(100)).fill(1)),
                radiusCurvePoints: [{ x: 0, y: 1, id: 0 }, { x: 1, y: 1, id: 1 }],
            },
            texture: "default",
            blendMode: "source-over",
        },
    }]);

    let videoSettings = $state({
        width: 960,
        height: 540,
        fps: 30,
        duration: 10,
    });

    /**
     * Generates a new frame based on the current parameters.
     * @param index which frame we are currently on. Used to tell time.
     * @param lastFrame data for the previous frame
     * @param rng seeded random number generator. We need to use the same one consistently to ensure deterministic results.
     */
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
                        direction: emitter.particleParams.direction.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.direction.variability,
                        rotation: emitter.particleParams.rotation.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.rotation.variability,
                        speed: emitter.particleParams.speed.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.speed.variability,
                        lifespan: emitter.particleParams.lifespan.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.lifespan.variability,
                        health: 1,
                        color: emitter.particleParams.color,
                        opacity: emitter.particleParams.lifetimeSettings.opacityCurve[0],
                        lifetimeSettings: emitter.particleParams.lifetimeSettings,
                        texture: emitter.particleParams.texture,
                        blendMode: emitter.particleParams.blendMode,
                    }
                    frame.particles.push(particle);
                }
            }
        }

        // copy particles from last frame and update their properties
        for (let particle of lastFrame.particles) {
            let copy: Particle = Object.assign({}, particle);

            let normalizedLife = Math.max(0, Math.min(1, 1 - copy.health));
            const lutIndex = Math.floor(normalizedLife * (particle.lifetimeSettings.opacityCurve.length - 1));

            let currentSpeed = particle.speed * particle.lifetimeSettings.speedCurve[lutIndex];
            copy.x += currentSpeed / videoSettings.fps * Math.cos(particle.direction * Math.PI / 180);
            copy.y += currentSpeed / videoSettings.fps * Math.sin(particle.direction * Math.PI / 180);
            copy.health -= 1 / (copy.lifespan * videoSettings.fps);
            
            copy.opacity = Math.max(0, Math.min(1, particle.lifetimeSettings.opacityCurve[lutIndex]));

            if (copy.health > 0) frame.particles.push(copy);
        }

        // remove dead particles
        frame.particles = frame.particles.filter(p => p.health > 0);

        return frame;
    }

    let frames: Frame[] = $state([]); // array of frame data
    /**
     * Generates the frame data for each frame.
     * This function is called whenever the user updates any parameter.
     */
    function createAnimationFrames() {
        let rng = new Srand(69);

        frames[0] = getNextFrame(0, { index: 0, particles: [] }, rng);
        for (let i = 1; i < videoSettings.duration * videoSettings.fps; i++) {
            frames[i] = getNextFrame(i, frames[i - 1], rng);
        }
    }

    // current frame that should be rendered (based on the video progress bar)
    let selectedFrame = $state(0);

    let videoPlaying = $state(false);
    /**
     * Starts the interval to show the animation.
     */
    function playVideo() {
        if (videoPlaying) {
            setTimeout(playVideo, 1000 / videoSettings.fps);
        }

        selectedFrame = (selectedFrame + 1) % (videoSettings.duration * videoSettings.fps);
    }

    /**
     * Renders a single frame of the animation.
     * @param ctx canvas context (2D)
     * @param frame frame data
     * @param bg background color
     */
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
            ctx.globalCompositeOperation = particle.blendMode;
            if (particle.texture === "default") {
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, 2 * Math.PI);
                ctx.fill();
            }
            else {
                const texture = textureManager.getTintedTexture(particle.texture, particle.color);
                ctx.translate(particle.x, particle.y);
                ctx.rotate((particle.direction + particle.rotation) * Math.PI / 180);
                ctx.drawImage(texture as CanvasImageSource, -particle.radius, -particle.radius, particle.radius * 2, particle.radius * 2);
            }
            ctx.restore();
        }
    }
    
    let exportModalOpen = $state(false);
    let isExporting = $state(false);

    /**
     * Exports the animation to MP4. Called when the user clicks the export button.
    */
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

    /**
     * Generate save file for the project and download it.
     */
    function saveProject() {
        let projectData: any = Object.assign({}, {
            emitters: emitters,
            videoSettings: videoSettings,
        });

        projectData.emitters.forEach((emitter: any, i: number) => {
            emitter.particleParams.lifetimeSettings.opacityCurve = Array.from(emitter.particleParams.lifetimeSettings.opacityCurve);
            emitter.particleParams.lifetimeSettings.radiusCurve = Array.from(emitter.particleParams.lifetimeSettings.radiusCurve);
            emitter.particleParams.lifetimeSettings.speedCurve = Array.from(emitter.particleParams.lifetimeSettings.speedCurve);
        });

        const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `particle_simulation_${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    /**
     * Loads a project from a save file into the editor.
     */
    function loadProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            const reader = new FileReader();
            reader.onload = async (e) => {
                const projectData = JSON.parse((e.target as FileReader).result as string);
                for (let emitter of projectData.emitters) {
                    emitter.particleParams.lifetimeSettings.opacityCurve = new Float32Array(emitter.particleParams.lifetimeSettings.opacityCurve);
                    emitter.particleParams.lifetimeSettings.radiusCurve = new Float32Array(emitter.particleParams.lifetimeSettings.radiusCurve);
                    emitter.particleParams.lifetimeSettings.speedCurve = new Float32Array(emitter.particleParams.lifetimeSettings.speedCurve);

                    if (emitter.particleParams.texture !== "default")
                        await textureManager.loadTexture(emitter.particleParams.texture, textureUrls[emitter.particleParams.texture]);
                }
                emitters = projectData.emitters;
                videoSettings = projectData.videoSettings;
                createAnimationFrames();
            };
            reader.readAsText(file as Blob);
        }
        input.click();
    }

    // onMount is called when the page is first loaded
    onMount(async () => {
        createAnimationFrames();
    });
</script>

<svelte:window onkeydown={(e) => {
    if (document.activeElement?.tagName === "INPUT") return;
    // pause/play when space is pressed
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
        <!-- Menubar -->
        <span class="font-bold">Particle Playground</span>
        <button onclick={() => {
            exportModalOpen = true;
        }}>Export</button>
        <button onclick={() => {
            settingsModalOpen = true;
        }}>Project Settings</button>
        <button onclick={() => {
            saveProject();
        }}>Save</button>
        <button onclick={() => {
            loadProject();
        }}>Load</button>
    </div>
    <div class="grow flex flex-row gap-4 min-h-0">
        <div class="grow flex justify-center items-center">
            <!-- Preview -->
            <Canvas width={videoSettings.width} height={videoSettings.height} class="w-full! h-full! object-contain">
                <Layer render={({ context: ctx }) => {
                    if (frames[selectedFrame]) {
                        drawFrame(ctx, frames[selectedFrame], "#000000");
                    }
                }} />
            </Canvas>
        </div>
        <div class="w-100 overflow-y-scroll pr-3 scrollbar-dark">
            <!-- Control Panel -->
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
                        <span class="grow"><span class="align-middle">Direction</span></span>
                        <input type="number" bind:value={emitter.particleParams.direction.value} onchange={createAnimationFrames} min={0} max={360} step={1} class="number-input" />
                        <span><span class="align-middle">±</span></span>
                        <input type="number" bind:value={emitter.particleParams.direction.variability} onchange={createAnimationFrames} min={0} max={360} step={1} class="number-input" />
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
                        <select bind:value={emitter.particleParams.texture} onchange={async () => {
                                if (emitter.particleParams.texture !== "default")
                                    await textureManager.loadTexture(emitter.particleParams.texture, textureUrls[emitter.particleParams.texture]);
                                createAnimationFrames();
                            }} class="dropdown">
                            <option value="default">Default</option>
                            <option value="smoke">Smoke</option>
                            <option value="dot">Dot</option>
                            <option value="circle_test">Circle (Test)</option>
                            <option value="energy">Energy</option>
                        </select>
                    </div>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Rotation</span></span>
                        <input type="number" bind:value={emitter.particleParams.rotation.value} onchange={createAnimationFrames} min={0} max={360} step={1} class="number-input" />
                        <span><span class="align-middle">±</span></span>
                        <input type="number" bind:value={emitter.particleParams.rotation.variability} onchange={createAnimationFrames} min={0} max={360} step={1} class="number-input" />
                    </div>
                    <div class="flex flex-row gap-2 m-1">
                        <span class="grow"><span class="align-middle">Blend Mode</span></span>
                        <select bind:value={emitter.particleParams.blendMode} onchange={createAnimationFrames} class="dropdown">
                            <option value="source-over">Normal</option>
                            <option value="multiply">Multiply</option>
                            <option value="screen">Screen</option>
                            <option value="darken">Darken</option>
                            <option value="lighten">Lighten</option>
                            <option value="lighter">Add</option>
                        </select>
                    </div>
                    <b>Particle Lifetime Settings</b>
                    <div class="m-1">
                        <span>Opacity curve</span>
                        <CurveEditor
                            bind:value={emitter.particleParams.lifetimeSettings.opacityCurve}
                            bind:points={emitter.particleParams.lifetimeSettings.opacityCurvePoints}
                            onchange={createAnimationFrames} />
                    </div>
                    <div class="m-1">
                        <span>Speed over time</span>
                        <CurveEditor
                            bind:value={emitter.particleParams.lifetimeSettings.speedCurve}
                            bind:points={emitter.particleParams.lifetimeSettings.speedCurvePoints}
                            onchange={createAnimationFrames} />
                    </div>
                </div>
            {/each}
        </div>
    </div>
    <div class="flex flex-row gap-4">
        <!-- Video Controls -->
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
<script lang="ts">
    import { onMount } from "svelte";
    import type { Particle, Emitter, Frame } from "$lib/types";
    import { Canvas, Layer } from "svelte-canvas";
    import Srand, { type SrandInstance } from "seeded-rand";

    let emitters: Emitter[] = [{
        shape: {
            type: 'point',
            x: 400,
            y: 300,
        },
        emissionRate: 10,
        particlesPerEmission: {
            value: 3,
            variability: 2,
        },
        particleParams: {
            radius: {
                value: 10,
                variability: 0,
            },
            rotation: {
                value: 0,
                variability: 90,
            },
            speed: {
                value: 100,
                variability: 40,
            },
            lifespan: {
                value: 2,
                variability: 0.5,
            },
            color: "#fff",
        },
    }];

    let videoSettings = {
        width: 800,
        height: 600,
        fps: 30,
        duration: 10,
    }

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
                        radius: 10,
                        rotation: emitter.particleParams.rotation.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.rotation.variability,
                        speed: emitter.particleParams.speed.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.speed.variability,
                        lifespan: emitter.particleParams.lifespan.value + rng.inRange(-0.5, 0.5) * emitter.particleParams.lifespan.variability,
                        health: 1,
                        color: "#fff",
                    }
                    frame.particles.push(particle);
                }
            }
        }

        // copy particles from last frame
        for (let particle of lastFrame.particles) {
            let copy: Particle = Object.assign({}, particle);
            copy.x += particle.speed / videoSettings.fps * Math.cos(particle.rotation * Math.PI / 180);
            copy.y += particle.speed / videoSettings.fps * Math.sin(particle.rotation * Math.PI / 180);
            copy.health -= 1 / (copy.lifespan * videoSettings.fps);
            if (copy.health > 0) frame.particles.push(copy);
        }

        // remove dead particles
        frame.particles = frame.particles.filter(p => p.health > 0);

        return frame;
    }

    let frames: Frame[] = $state([]);
    function createAnimationFrames() {
        let rng = new Srand(69);

        frames[0] = { index: 0, particles: [] };
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

    onMount(async () => {
        createAnimationFrames();
    });
</script>

<div class="flex flex-col w-full h-full gap-5 p-5 box-border">
    <div class="grow flex flex-row gap-4">
        <div class="grow flex justify-center items-center">
            <Canvas width={800} height={600}>
                <Layer render={({ context: ctx }) => {
                    ctx.save();
                    ctx.fillStyle = "#000";
                    ctx.fillRect(0, 0, 800, 600);
                    ctx.restore();
                }} />
                {#if frames[selectedFrame]}
                    {#each frames[selectedFrame].particles as particle}
                        <Layer render={({ context: ctx }) => {
                            ctx.save();
                            ctx.fillStyle = particle.color;
                            ctx.globalAlpha = particle.health;
                            ctx.beginPath();
                            ctx.arc(particle.x, particle.y, particle.radius, 0, 2 * Math.PI);
                            ctx.fill();
                            ctx.restore();
                        }} />
                    {/each}
                {/if}
            </Canvas>
        </div>
        <div class="w-100">
            <b>Emitters</b>
        </div>
    </div>
    <div class="flex flex-row gap-4">
        <input type="checkbox" bind:checked={videoPlaying} onchange={playVideo} />
        <input type="range" min={0} max={videoSettings.duration * videoSettings.fps - 1} bind:value={selectedFrame}
            class="grow" />
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        width: 100vw;
        height: 100vh;
    }
</style>
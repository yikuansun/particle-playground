<script lang="ts">
    import { onMount } from "svelte";
    import type { Particle, Emitter, Frame } from "$lib/types";
    import { Canvas, Layer } from "svelte-canvas";

    let emitters: Emitter[] = [{
        shape: {
            type: 'point',
            x: 400,
            y: 300,
        },
        emissionRate: {
            value: 1,
            variability: 0,
        },
        particlesPerEmission: {
            value: 1,
            variability: 0,
        },
        life: {
            value: 1,
            variability: 0,
        },
        speed: {
            value: 30,
            variability: 0,
        },
        rotation: {
            value: 0,
            variability: 0,
        },
    }];

    let videoSettings = {
        width: 800,
        height: 600,
        fps: 30,
        duration: 10,
    }

    function getNextFrame(index: number, lastFrame: Frame) {
        let frame: Frame = { index, particles: [] };

        for (let emitter of emitters) {
            if (index % Math.floor(videoSettings.fps / emitter.emissionRate.value) === 0) {
                // emit new particles
                for (let i = 0; i < emitter.particlesPerEmission.value; i++) {
                    let particle: Particle = {
                        x: emitter.shape.x,
                        y: emitter.shape.y,
                        radius: 10,
                        rotation: emitter.rotation.value,
                        speed: emitter.speed.value,
                        life: emitter.life.value,
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
            frame.particles.push(copy);
        }

        return frame;
    }

    let frames: Frame[] = $state([]);
    function createAnimationFrames() {
        frames[0] = { index: 0, particles: [] };
        for (let i = 1; i < videoSettings.duration * videoSettings.fps; i++) {
            frames[i] = getNextFrame(i, frames[i - 1]);
        }
    }

    let selectedFrame = $state(0);

    onMount(async () => {
        createAnimationFrames();
    });
</script>

<Canvas width={800} height={600}>
    <Layer render={({ context: ctx }) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 800, 600);
    }} />
    {#if frames[selectedFrame]}
        {#each frames[selectedFrame].particles as particle}
            <Layer render={({ context: ctx }) => {
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, 2 * Math.PI);
                ctx.fill();
            }} />
        {/each}
    {/if}
</Canvas>

<input type="range" min={0} max={videoSettings.duration * videoSettings.fps - 1} bind:value={selectedFrame} />
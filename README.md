# Yikuan's Particle Playground

A customizable particle system for visual effects. Built with Svelte and TypeScript.

### [Try it out online](https://yikuansun.github.io/particle-playground/)

## Features

- Customizable particle system with particle parameters
- Particle emission with random variation
- Particle lifetime curves with random variation
- Video export to MP4
- Save and load projects

## Setup

### Development

1. Clone the repository
2. Install dependencies with `npm install`
3. Run the development server with `npm run dev`
4. Open `http://localhost:5173` in your browser

### Production

1. Build the project with `npm run build`
2. Run `npm run preview` to launch the production server
3. Open `http://localhost:4173` in your browser

## Dependencies

- [Svelte](https://svelte.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Svelte Canvas](https://danielnass.net/svelte-canvas/)
- [Seeded Rand](https://www.npmjs.com/package/seeded-rand)
- [MP4 Muxer](https://github.com/Vanilagy/mp4-muxer?tab=readme-ov-file)
- [Tailwind Material Symbols](https://www.npmjs.com/package/@savaryna/tailwindcss-material-symbols)

## Usage

Once you open the project in your browser, you can start creating particle systems. The editor is divided into four parts: at the top, there is the menubar, from which you can export the video, modify the project settings, and save/load projects to/from your computer. Below that and on the left, you can see a preview of the current effect. At the bottom of the screen, there are controls for playing/pausing the video and changing the current frame. You can use this to preview the effect in real-time, or pause at a specific frame. To the right of the preview, you can see the parameters for the particle system. You can modify these parameters to create different effects. The following section will go over each parameter in detail:

### Emitter Properties

- **Position**: The position of the emitter. This is where each particle spawns from.
- **Emissions per second**: The rate at which particles are emitted, in hertz.
- **Particles per emission**: The number of particles emitted per emission. This value can be randomized. The first value is the base value, and the second value is the variability.

### Default particle parameters

- **Radius**: The radius of each particle.
- **Direction**: The direction of each particle, in degrees. 0 is to the right, 90 is straight down, 180 is to the left, and 270 is straight up.
- **Speed**: The speed of each particle, in pixels per second.
- **Lifespan**: How long each particle stays on screen, in seconds.
- **Color**: The color of each particle.
- **Texture**: The sprite used for each particle.
- **Rotation**: The rotation of each particle, in degrees.
- **Blend Mode**: The blend mode used for each particle. This determines how the particles interact with each other visually.

### Particle Lifetime Settings

- **Opacity curve**: The opacity of each particle over time. The x-axis represents the particle's lifespan (from the particle's birth to its death), and the y-axis represents the opacity (with 0 at the bottom and 1 at the top).
- **Speed over time**: The speed of each particle over time. The x-axis represents the particle's lifespan (from the particle's birth to its death), and the y-axis represents the speed (with 0 at the bottom and the maximum speed (as defined in the particle parameters) at the top).

## Roadmap

- Implement 3D space
- Allow for multiple emitters
- Implement different emitter shapes (circle, rectangle, etc.)
- Allow more export options (GIF, PNG sequence, etc.)
- Add more particle lifetime settings (size, rotation, etc.)
- Make more textures
- Add forces (gravity, wind, noise map, etc.)
# Yikuan's Particle Playground

A customizable particle system for visual effects. Built with Svelte and TypeScript.

## Features

- Customizable particle system with particle parameters
- Particle emission with random variation
- Particle lifetime curves with random variation
- Video export to MP4
- Save and load projects

## Usage

### Development

1. Clone the repository
2. Install dependencies with `npm install`
3. Run the development server with `npm run dev`
4. Open `http://localhost:5173` in your browser

### Production

1. Build the project with `npm run build`
2. Serve the built files (in the `docs` directory) with your preferred method

## Dependencies

- [Svelte](https://svelte.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Svelte Canvas](https://danielnass.net/svelte-canvas/)
- [Seeded Rand](https://www.npmjs.com/package/seeded-rand)
- [MP4 Muxer](https://github.com/Vanilagy/mp4-muxer?tab=readme-ov-file)
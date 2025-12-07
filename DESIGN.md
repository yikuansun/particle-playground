# Design Decisions

## Language and Framework

I decided to build the project using front-end web technologies. This decision was made for several reasons:

1. I wanted to make the project easily distributable and accessible to a wider audience. A web-based application can be used by anyone with a web browser, and since it is front-end-only, it can be compiled into a desktop app using Electron.
2. Modern web technologies, such as Tailwind CSS and Svelte, are well-suited for building user interfaces. I quickly realized that particle systems are easy to generate in code, but can be complicated to create and customize without a clean, intuitive interface; thus UI was a crucial aspect of the project.
3. I am most familiar with web development.

For the framework, I chose Svelte, due to its performance and ease of use. Unlike React, Svelte compiles to highly optimized JavaScript. This is especially important for visual effects software, as fast rendering is needed to implement real-time previews. Additionally, Svelte's reactive system makes it easy to manage state and handle complex logic.

I also chose TypeScript for type safety and code organization. TypeScript provides static type checking, which helps catch errors early in the development process. It also provides better code organization, as TypeScript files can be imported and used in other files without any issues.

## Project Structure

The project is organized into several files and folders:

- `src/lib`: This folder contains the Svelte components and utilities used throughout the project.
- `src/routes`: This folder contains the main application routes, including the layout and the main page.
- `src/routes/+page.svelte`: This file contains the main page of the application, which is the entry point for the application.
- `docs`: This folder contains all of the build files for the application, including the compiled JavaScript, CSS, and HTML files. It is NOT actual documentation. This is because GitHub Pages only serves files from the `docs` folder.
- `presets`: This folder contains a few save files you can use to test the application. To use them, simply press the "Load" button in the main page.

## UI Design

As mentioned earlier, UI was a crucial aspect of the project. I based the base layout on some of my previous computer graphics projects, which are popular with users. This includes the preview on the left and a scrollable control panel on the right. However, I also added a menubar at the top for additional options. In the future, more options may be added to the menubar. Additionally, since this project was made to generate video animations (rather than my previous projects, which focused on static images), I added simple video controls at the bottom of the screen.

Random variation of parameters was a crucial feature, since it allows for more interesting and dynamic effects. In my previous projects, I always made had a parameter for value and a separate parameter for variance. However, for this project, I decided to simplify the interface by using a single parameter for both value and variance, denoted by the ± symbol. This simplifies the interface and makes it easier to understand the effects of each parameter.

Particle lifetime settings are often a complicated part of particle system UIs. Done poorly, they can be difficult to use and reduce customization ability. For instance, in the built-in particle systems in Adobe After Effects, you can only change a few start/end parameters using standard numeric inputs. In this project, I decided to build a custom curve editor for each lifetime parameter, taking inspiration from Photoshop's Curves adjustment. This allows for more precise control over the particle lifetime, and makes it easier to customize the effects. For instance, you can adjust the opacity curve to create a gradual fade-in effect, or adjust the speed curve to make a particle move faster or slower over time. You can even create your own custom wiggle curve to make a unique effect.

## Algorithmic Overview

To allow for real-time previews, we split up generation into different steps. First, we call `createAnimationFrames()` to generate data for each frame - not the fully-rendered frames, but information about the placement of each particle. This function is executed at the beginning, and whenever the user updates any parameter. The frame data is stored in the array `frames`. Next, the `drawFrame()` function renders __only the selected frame__ (based on how far the video progress bar has moved). This way, whenever the user moves to a different time in the video, we only need to render that frame. Since the frame data has already been generated, we can very quickly render the selected frame. To allow for smooth playback, we simply create an interval that calls `drawFrame()` at a fixed rate, based on the FPS setting.
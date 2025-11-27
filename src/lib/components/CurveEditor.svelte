<script lang="ts">
	import { onMount } from 'svelte';

	let { 
		value = $bindable(), 
		resolution = 100,
		color = "#3b82f6",
		height = 200
	} = $props();

	// Types
	type Point = { x: number; y: number; id: number };

	// Initialize state
	// We ensure there is always a start (0,y) and end (1,y) point
	let points: Point[] = $state([
		{ x: 0, y: 0.5, id: 1 },
		{ x: 0.25, y: 0.8, id: 2 }, // Default S-curve shape
		{ x: 0.75, y: 0.2, id: 3 },
		{ x: 1, y: 0.5, id: 4 }
	]);

	let draggingPointId: number | null = $state(null);
	let hoverPointId: number | null = $state(null);
	let svgElement: SVGSVGElement | null = $state(null);

	// Generate the Lookup Table (LUT) whenever points change
	// This is what your particle system will actually READ.
	$effect(() => {
		// Sort points by X to ensure valid function
		const sorted = [...points].sort((a, b) => a.x - b.x);
		
		// Create the LUT
		const lut = new Float32Array(resolution);
		for (let i = 0; i < resolution; i++) {
			const t = i / (resolution - 1);
			lut[i] = solveCatmullRom(t, sorted);
		}
		
		// Update the bound value
		value = lut;
	});

	// --- Math Helpers (Catmull-Rom Spline) ---
	
	function solveCatmullRom(t: number, pts: Point[]): number {
		// 1. Find the segment t is inside
		// We want p1 and p2 to be the points surrounding t
		let p0, p1, p2, p3;
		
		// Find index where point.x > t
		let i = 0;
		while (i < pts.length && pts[i].x <= t) i++;
		
		// Handle edge cases
		if (i === 0) return pts[0].y;
		if (i === pts.length) return pts[pts.length - 1].y;

		// Indices for the 4 points needed for calculation
		const idx1 = i - 1;
		const idx2 = i;
		const idx0 = Math.max(0, idx1 - 1);
		const idx3 = Math.min(pts.length - 1, idx2 + 1);

		p0 = pts[idx0];
		p1 = pts[idx1];
		p2 = pts[idx2];
		p3 = pts[idx3];

		// Normalize t to be between 0 and 1 for this specific segment
		const segmentRange = p2.x - p1.x;
		if (segmentRange <= 0.0001) return p1.y;
		
		const localT = (t - p1.x) / segmentRange;

		// Perform Catmull-Rom interpolation
		// We treat X as linear time, so we only interpolate Y
		const t2 = localT * localT;
		const t3 = t2 * localT;

		const m0 = (p2.y - p0.y) * 0.5;
		const m1 = (p3.y - p1.y) * 0.5;

		return (2 * t3 - 3 * t2 + 1) * p1.y +
			   (t3 - 2 * t2 + localT) * m0 + 
			   (-2 * t3 + 3 * t2) * p2.y + 
			   (t3 - t2) * m1;
	}

	function generatePath(pts: Point[], width: number, h: number): string {
		if (pts.length < 2) return "";
		
		// Generate high-res SVG path by sampling the spline
		// This ensures the visual line matches the LUT data exactly
		let d = `M ${pts[0].x * width} ${(1 - pts[0].y) * h}`;
		
		const steps = 100;
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			const x = t * width;
			const y = (1 - solveCatmullRom(t, pts)) * h;
			d += ` L ${x} ${y}`;
		}
		return d;
	}

	// --- Interaction Handlers ---

	function clientToLocal(e: PointerEvent) {
		if (!svgElement) return { x: 0, y: 0 };
		const rect = svgElement.getBoundingClientRect();
		return {
			x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
			y: Math.max(0, Math.min(1, 1 - ((e.clientY - rect.top) / rect.height)))
		};
	}

	function handleDown(e: PointerEvent, id: number) {
		e.stopPropagation();
		e.target?.setPointerCapture(e.pointerId);
		draggingPointId = id;
	}

	function handleMove(e: PointerEvent) {
		if (draggingPointId === null) return;
		
		const pos = clientToLocal(e);
		
		points = points.map(p => {
			if (p.id !== draggingPointId) return p;

			// Logic constraints:
			// 1. Start and End points are locked to X=0 and X=1
			let newX = pos.x;
			const index = points.findIndex(pt => pt.id === draggingPointId);
			
			if (index === 0) newX = 0;
			else if (index === points.length - 1) newX = 1;
			else {
				// 2. Points cannot cross each other on X axis (simplified constraint)
				// A more advanced editor would swap indices, but clamping is safer for UX
				const prev = points[index - 1];
				const next = points[index + 1];
				if (prev) newX = Math.max(prev.x + 0.01, newX);
				if (next) newX = Math.min(next.x - 0.01, newX);
			}

			return { ...p, x: newX, y: pos.y };
		});
	}

	function handleUp(e: PointerEvent) {
		draggingPointId = null;
		e.target?.releasePointerCapture(e.pointerId);
	}

	function handleBgDblClick(e: MouseEvent) {
		const pos = clientToLocal(e as unknown as PointerEvent);
		
		// Insert point in the correct sorted position
		const newPoint = { x: pos.x, y: pos.y, id: Date.now() };
		const index = points.findIndex(p => p.x > pos.x);
		
		if (index === -1) return; // Should not happen given 0 and 1 bounds
		
		const newPoints = [...points];
		newPoints.splice(index, 0, newPoint);
		points = newPoints;
	}

	function handlePointDblClick(e: MouseEvent, id: number) {
		e.stopPropagation();
		// Prevent deleting start/end points
		const index = points.findIndex(p => p.id === id);
		if (index === 0 || index === points.length - 1) return;
		
		points = points.filter(p => p.id !== id);
	}

	// Helper for rendering Grid
	const gridLines = [0, 0.25, 0.5, 0.75, 1];

</script>

<div class="curve-container" style:height="{height}px">
	<svg 
		bind:this={svgElement}
		width="100%" 
		height="100%" 
		onpointermove={handleMove}
		onpointerup={handleUp}
		ondblclick={handleBgDblClick}
		role="application"
	>
		<!-- Grid Background -->
		{#each gridLines as pos}
			<!-- Vertical -->
			<line x1="{pos * 100}%" y1="0" x2="{pos * 100}%" y2="100%" class="grid-line" />
			<!-- Horizontal -->
			<line x1="0" y1="{pos * 100}%" x2="100%" y2="{pos * 100}%" class="grid-line" />
		{/each}

		<!-- The Curve -->
		<!-- We need a wrapper div/rect for the size, but SVG path coordinates need pixel values usually
			 or a viewBox. Here we calculate path strings using percentage-like logic in JS -->
		{#if svgElement}
			<path 
				d={generatePath(points, svgElement.clientWidth, svgElement.clientHeight)}
				stroke={color}
				stroke-width="2"
				fill="none"
				class="curve-path"
			/>
		{/if}

		<!-- Control Points -->
		{#each points as p, i}
			<!-- Connection Line to bottom (optional, makes it look like an integral) -->
			<!-- <line x1={p.x * 100 + '%'} y1={(1 - p.y) * 100 + '%'} x2={p.x * 100 + '%'} y2="100%" stroke="rgba(255,255,255,0.1)" /> -->

			<!-- Touch Target (invisible, larger) -->
			<circle 
				cx="{p.x * 100}%" 
				cy="{(1 - p.y) * 100}%" 
				r="12" 
				fill="transparent"
				class="touch-target"
				onpointerdown={(e) => handleDown(e, p.id)}
				ondblclick={(e) => handlePointDblClick(e, p.id)}
				onpointerenter={() => hoverPointId = p.id}
				onpointerleave={() => hoverPointId = null}
				style:cursor={draggingPointId === p.id ? 'grabbing' : 'grab'}
			/>

			<!-- Visual Point -->
			<circle 
				cx="{p.x * 100}%" 
				cy="{(1 - p.y) * 100}%" 
				r="4" 
				fill={draggingPointId === p.id || hoverPointId === p.id ? '#fff' : color}
				stroke="#000"
				stroke-width="1"
				class="visual-point"
				style:pointer-events="none"
			/>
		{/each}
	</svg>
</div>

<style>
	.curve-container {
		width: 100%;
		background: #1e1e1e;
		border-radius: 4px;
		border: 1px solid #333;
		overflow: hidden;
		user-select: none;
	}

	svg {
		display: block;
		cursor: crosshair;
	}

	.grid-line {
		stroke: #333;
		stroke-width: 1;
	}

	.curve-path {
		pointer-events: none;
		filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
	}

	.touch-target {
		touch-action: none; 
	}
	
	.visual-point {
		transition: r 0.1s;
	}
</style>
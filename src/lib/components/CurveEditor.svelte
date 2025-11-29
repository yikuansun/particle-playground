<script lang="ts">
	import { onMount } from 'svelte';

	let { 
		value = $bindable(), 
		resolution = 100,
		color = "#3b82f6",
		height = 200,
        onchange = () => {},
	} = $props();

	// Types
	type Point = { x: number; y: number; id: number };

	// Initialize state
	// We ensure there is always a start (0,y) and end (1,y) point
	let points: Point[] = $state([
		{ x: 0, y: 1, id: 1 },
		{ x: 1, y: 0, id: 2 }
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
			lut[i] = solveCubicHermite(t, sorted);
		}
		
		// Update the bound value
		value = lut;
	});

	// --- Math Helpers (Cubic Hermite Spline) ---
	// Solves for Y given X (t) using non-uniform spacing to ensure C1 continuity
	function solveCubicHermite(t: number, pts: Point[]): number {
		// 1. Find the segment t is inside
		// Find index `i` such that pts[i].x > t. 
		let i = 0;
		while (i < pts.length && pts[i].x <= t) i++;
		
		// Handle edge cases
		if (i === 0) return pts[0].y;
		if (i === pts.length) return pts[pts.length - 1].y;

		const pLeft = pts[i - 1];
		const pRight = pts[i];
		
		// 2. Identify neighbors for tangent calculations
		const pPrev = i - 2 >= 0 ? pts[i - 2] : pLeft;
		const pNext = i + 1 < pts.length ? pts[i + 1] : pRight;

		const segmentWidth = pRight.x - pLeft.x;
		if (segmentWidth <= 0.000001) return pLeft.y;

		// 3. Calculate Slopes (Finite Difference / Secant method)
		// This creates smooth tangents by looking at the neighbors
		
		// Slope at Start of Segment (pLeft)
		let slopeLeft;
		if (pLeft === pPrev) {
			slopeLeft = (pRight.y - pLeft.y) / (pRight.x - pLeft.x);
		} else {
			// Secant slope between Prev and Right
			slopeLeft = (pRight.y - pPrev.y) / (pRight.x - pPrev.x);
		}

		// Slope at End of Segment (pRight)
		let slopeRight;
		if (pRight === pNext) {
			slopeRight = (pRight.y - pLeft.y) / (pRight.x - pLeft.x);
		} else {
			// Secant slope between Left and Next
			slopeRight = (pNext.y - pLeft.y) / (pNext.x - pLeft.x);
		}

		// 4. Interpolate using Cubic Hermite Basis
		const localT = (t - pLeft.x) / segmentWidth;
		
		// Scale tangents to the local interval 0..1
		const m0 = slopeLeft * segmentWidth;
		const m1 = slopeRight * segmentWidth;

		const t2 = localT * localT;
		const t3 = t2 * localT;

		const h00 = 2 * t3 - 3 * t2 + 1;
		const h10 = t3 - 2 * t2 + localT;
		const h01 = -2 * t3 + 3 * t2;
		const h11 = t3 - t2;

		return h00 * pLeft.y + 
			   h10 * m0 + 
			   h01 * pRight.y + 
			   h11 * m1;
	}

	function generatePath(pts: Point[], width: number, h: number): string {
		if (pts.length < 2) return "";
		
		// Sort points for rendering logic (safety)
		const sorted = [...pts].sort((a, b) => a.x - b.x);

		let d = `M ${sorted[0].x * width} ${(1 - sorted[0].y) * h}`;
		
		// Increase steps for smoother visual rendering
		const steps = 200;
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			const x = t * width;
			// Clip Y to 0-1 for rendering safety, though math should hold
			const val = Math.max(0, Math.min(1, solveCubicHermite(t, sorted)));
			const y = (1 - val) * h;
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

	function handlePointDown(e: PointerEvent, id: number) {
		e.stopPropagation();
		e.target?.setPointerCapture(e.pointerId);
		draggingPointId = id;
	}

	function handleBackgroundDown(e: PointerEvent) {
		e.preventDefault();

		const pos = clientToLocal(e);
		
		const newId = Date.now();
		const newPoint = { x: pos.x, y: pos.y, id: newId };
		
		const index = points.findIndex(p => p.x > pos.x);
		
		if (index === -1) return; 
		
		const newPoints = [...points];
		newPoints.splice(index, 0, newPoint);
		points = newPoints;

		draggingPointId = newId;
		(e.target as Element).setPointerCapture(e.pointerId);
	}

	function handleMove(e: PointerEvent) {
		if (draggingPointId === null) return;
		
		const pos = clientToLocal(e);
		
		points = points.map(p => {
			if (p.id !== draggingPointId) return p;

			let newX = pos.x;
			const index = points.findIndex(pt => pt.id === draggingPointId);
			
			// Constraints
			if (index === 0) newX = 0;
			else if (index === points.length - 1) newX = 1;
			else {
				// Prevent crossover
				const prev = points[index - 1];
				const next = points[index + 1];
				// Add small buffer to prevent exact overlap division by zero
				if (prev) newX = Math.max(prev.x + 0.001, newX);
				if (next) newX = Math.min(next.x - 0.001, newX);
			}

			return { ...p, x: newX, y: pos.y };
		});
	}

	function handleUp(e: PointerEvent) {
		draggingPointId = null;
		e.target?.releasePointerCapture(e.pointerId);
        onchange(value);
	}

	function handlePointDblClick(e: MouseEvent, id: number) {
		e.stopPropagation();
		const index = points.findIndex(p => p.id === id);
		if (index === 0 || index === points.length - 1) return;
		
		points = points.filter(p => p.id !== id);
	}

	const gridLines = [0, 0.25, 0.5, 0.75, 1];

</script>

<div class="curve-container" style:height="{height}px">
	<svg 
		bind:this={svgElement}
		width="100%" 
		height="100%" 
		onpointermove={handleMove}
		onpointerup={handleUp}
		onpointerdown={handleBackgroundDown}
		role="application"
	>
		{#each gridLines as pos}
			<line x1="{pos * 100}%" y1="0" x2="{pos * 100}%" y2="100%" class="grid-line" />
			<line x1="0" y1="{pos * 100}%" x2="100%" y2="{pos * 100}%" class="grid-line" />
		{/each}

		{#if svgElement}
			<path 
				d={generatePath(points, svgElement.clientWidth, svgElement.clientHeight)}
				stroke={color}
				stroke-width="2"
				fill="none"
				class="curve-path"
			/>
		{/if}

		{#each points as p}
			<circle 
				cx="{p.x * 100}%" 
				cy="{(1 - p.y) * 100}%" 
				r="12" 
				fill="transparent"
				class="touch-target"
				onpointerdown={(e) => handlePointDown(e, p.id)}
				ondblclick={(e) => handlePointDblClick(e, p.id)}
				onpointerenter={() => hoverPointId = p.id}
				onpointerleave={() => hoverPointId = null}
				style:cursor={draggingPointId === p.id ? 'grabbing' : 'grab'}
			/>

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
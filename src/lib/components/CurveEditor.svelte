<script module>
	export type Point = { x: number; y: number; id: number };
</script>

<script lang="ts">
	import { tick } from 'svelte';

	let { 
		value = $bindable(), 
		points = $bindable(),
		resolution = 100,
		color = "#3b82f6",
		height = 200,
		onchange = () => {},
		defaultPoints = [
			{ x: 0, y: 1 },
			{ x: 1, y: 0 }
		]
	} = $props();

	// Initialization / Hydration Logic
	// If points are not provided, use defaults.
	// If points ARE provided (e.g. from save file), ensure they have IDs.
	if (!points || points.length === 0) {
		points = defaultPoints.map((p, i) => ({
			x: p.x,
			y: p.y,
			id: i // Simple ID generation for defaults
		}));
	} else {
		// Check for missing IDs (common when loading from simple JSON)
		// We reassign to ensure the view updates with the new IDs
		const needsIds = points.some((p: any) => p.id === undefined);
		if (needsIds) {
			points = points.map((p: any, i: number) => ({
				x: p.x,
				y: p.y,
				id: p.id !== undefined ? p.id : Date.now() + i
			}));
		}
	}

	let draggingPointId: number | null = $state(null);
	let hoverPointId: number | null = $state(null);
	let svgElement: SVGSVGElement | null = $state(null);

	// Generate the Lookup Table (LUT) whenever points change
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
	function solveCubicHermite(t: number, pts: Point[]): number {
		let i = 0;
		while (i < pts.length && pts[i].x <= t) i++;
		
		if (i === 0) return pts[0].y;
		if (i === pts.length) return pts[pts.length - 1].y;

		const pLeft = pts[i - 1];
		const pRight = pts[i];
		
		const pPrev = i - 2 >= 0 ? pts[i - 2] : pLeft;
		const pNext = i + 1 < pts.length ? pts[i + 1] : pRight;

		const segmentWidth = pRight.x - pLeft.x;
		if (segmentWidth <= 0.000001) return pLeft.y;

		// Calculate Slopes
		let slopeLeft;
		if (pLeft === pPrev) {
			slopeLeft = (pRight.y - pLeft.y) / (pRight.x - pLeft.x);
		} else {
			slopeLeft = (pRight.y - pPrev.y) / (pRight.x - pPrev.x);
		}

		let slopeRight;
		if (pRight === pNext) {
			slopeRight = (pRight.y - pLeft.y) / (pRight.x - pLeft.x);
		} else {
			slopeRight = (pNext.y - pLeft.y) / (pNext.x - pLeft.x);
		}

		// Interpolate
		const localT = (t - pLeft.x) / segmentWidth;
		
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
		
		const sorted = [...pts].sort((a, b) => a.x - b.x);

		let d = `M ${sorted[0].x * width} ${(1 - sorted[0].y) * h}`;
		
		const steps = 200;
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			const x = t * width;
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
		
		const index = points.findIndex((p: Point) => p.x > pos.x);
		
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
		
		points = points.map((p: Point) => {
			if (p.id !== draggingPointId) return p;

			let newX = pos.x;
			const index = points.findIndex((pt: Point) => pt.id === draggingPointId);
			
			if (index === 0) newX = 0;
			else if (index === points.length - 1) newX = 1;
			else {
				const prev = points[index - 1];
				const next = points[index + 1];
				if (prev) newX = Math.max(prev.x + 0.001, newX);
				if (next) newX = Math.min(next.x - 0.001, newX);
			}

			return { ...p, x: newX, y: pos.y };
		});
	}

	async function handleUp(e: PointerEvent) {
		const wasDragging = draggingPointId !== null;
		draggingPointId = null;
		e.target?.releasePointerCapture(e.pointerId);

		if (wasDragging) {
			await tick();
			onchange();
		}
	}

	async function handlePointDblClick(e: MouseEvent, id: number) {
		e.stopPropagation();
		const index = points.findIndex((p: Point) => p.id === id);
		if (index === 0 || index === points.length - 1) return;
		
		points = points.filter((p: Point) => p.id !== id);
		
		await tick();
		onchange();
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
			<!-- svelte-ignore a11y_no_static_element_interactions -->
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
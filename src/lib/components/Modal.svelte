<script lang="ts">
    import { fade, scale, slide } from "svelte/transition";

    let { open=$bindable(false), children, title="Info" } = $props();
</script>

{#if open}
    <button class="fixed top-0 left-0 w-full h-full bg-black/69" onclick={() => {
        open = false;
    }} title="Close Modal" transition:fade></button>

    <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-5 bg-neutral-900 rounded-lg shadow-xl"
        transition:slide={{ axis: "y" }}>
        <div class="pb-1 border-b-2 border-b-neutral-800 flex flex-row mb-2">
            <h3 class="text-lg font-bold grow">{title}</h3>
            <button class="text-neutral-200 text-sm p-1 hover:rotate-180 transition-transform" onclick={() => {
                open = false;
            }} title="Close">&#10005;</button>
        </div>
        {@render children?.()}
    </div>
{/if}
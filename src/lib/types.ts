export type EmitterShape = {
    type: 'point';
    x: number;
    y: number;
} | {
    type: 'circle';
    x: number;
    y: number;
    radius: number;
} | {
    type: 'rectangle';
    x: number;
    y: number;
    width: number;
    height: number;
};

export interface PMNumber {
    value: number;
    variability: number;
}

export interface Emitter {
    shape: EmitterShape;
    emissionRate: PMNumber;
    particlesPerEmission: PMNumber;
    life: PMNumber;
    speed: PMNumber;
    rotation: PMNumber;
}

export interface Particle {
    x: number;
    y: number;
    radius: number;
    rotation: number;
    speed: number;
    life: number;
    color: string;
}
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
    emissionRate: number;
    particlesPerEmission: PMNumber;
    particleParams: ParticleParams;
}

export interface Particle {
    x: number;
    y: number;
    radius: number;
    rotation: number;
    speed: number;
    lifespan: number;
    health: number;
    color: string;
    opacity: number;
    lifetimeSettings: ParticleLifetimeSettings;
    texture: string;
}

export interface ParticleParams {
    radius: PMNumber;
    rotation: PMNumber;
    speed: PMNumber;
    lifespan: PMNumber;
    color: string;
    lifetimeSettings: ParticleLifetimeSettings;
    texture: string;
}

export type CurveLut = Float32Array;

export interface ParticleLifetimeSettings {
    opacityCurve: CurveLut;
    speedCurve: CurveLut;
    radiusCurve: CurveLut;
}

export interface Frame {
    index: number;
    particles: Particle[];
}
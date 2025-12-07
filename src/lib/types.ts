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

export type BlendMode = 'source-over' | 'multiply' | 'screen' | 'darken' | 'lighten' | 'lighter';

export interface CurvePoint {
    x: number;
    y: number;
    id: number;
}

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
    direction: number;
    rotation: number;
    speed: number;
    lifespan: number;
    health: number;
    color: string;
    opacity: number;
    lifetimeSettings: ParticleLifetimeSettings;
    texture: string;
    blendMode: BlendMode;
}

export interface ParticleParams {
    radius: PMNumber;
    direction: PMNumber;
    rotation: PMNumber;
    speed: PMNumber;
    lifespan: PMNumber;
    color: string;
    lifetimeSettings: ParticleLifetimeSettings;
    texture: string;
    blendMode: BlendMode;
}

export type CurveLut = Float32Array;

export interface ParticleLifetimeSettings {
    opacityCurve: CurveLut;
    opacityCurvePoints: CurvePoint[];
    speedCurve: CurveLut;
    speedCurvePoints: CurvePoint[];
    radiusCurve: CurveLut;
    radiusCurvePoints: CurvePoint[];
}

export interface Frame {
    index: number;
    particles: Particle[];
}
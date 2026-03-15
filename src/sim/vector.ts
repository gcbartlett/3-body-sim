import type { Vec2 } from "./types";

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k });
export const magnitudeSquared = (v: Vec2): number => v.x * v.x + v.y * v.y;
export const magnitude = (v: Vec2): number => Math.sqrt(magnitudeSquared(v));


export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const lerp = (start, end, progress) => start + (end - start) * progress;

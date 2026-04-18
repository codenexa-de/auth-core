import type { Clock } from "../interfaces/providers.js";

export const systemClock: Clock = {
    now: () => new Date(),
};


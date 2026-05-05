import gesturesJson from './raw/gestures.json';
import type { Gesture } from './types';

export const gestures = gesturesJson as unknown as Gesture[];

export type { Gesture };

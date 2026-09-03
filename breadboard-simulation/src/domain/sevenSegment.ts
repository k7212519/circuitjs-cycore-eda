export const SEVEN_SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const
export type SevenSegmentName = typeof SEVEN_SEGMENT_NAMES[number]

// SC56-11EWA physical pin order, viewed from the front and numbered 1-10.
export const SEVEN_SEGMENT_PHYSICAL_PIN_NAMES = [
  'e', 'd', 'GND', 'c', 'dp', 'b', 'a', 'GND', 'f', 'g',
] as const

// CircuitJS SevenSegElm exposes a,b,c,d,e,f,g,dp,common in that order.
export const SEVEN_SEGMENT_CORE_TO_PHYSICAL_INDEX = [6, 5, 3, 1, 0, 8, 9, 4] as const
export const SEVEN_SEGMENT_COMMON_CORE_INDEX = 8
export const SEVEN_SEGMENT_COMMON_PHYSICAL_INDICES = [2, 7] as const

export const SEVEN_SEGMENT_MODEL = 'SC56-11EWA'
export const SEVEN_SEGMENT_MAX_BRIGHTNESS_CURRENT = 0.01

// Physical numbering starts at the bottom left: 1–8 below, 16–9 above.
export const CD4026_PHYSICAL_PIN_NAMES = [
  'CLK', 'INH', 'DEI', 'DEO', 'CO', 'f', 'g', 'VSS',
  'd', 'a', 'e', 'b', 'c', 'UCS', 'RESET', 'VDD',
] as const

export const CD4026_REQUIRED_PHYSICAL_INDICES = [0, 1, 2, 7, 14, 15] as const

// CD4026Elm stores its terminal array in physical pin order, but lays those
// terminals out in functional groups on the west and east sides of the core.
export const CD4026_CORE_POST_LAYOUT = [
  { side: 'left', position: 0 },
  { side: 'left', position: 2 },
  { side: 'left', position: 1 },
  { side: 'left', position: 7 },
  { side: 'left', position: 4 },
  { side: 'right', position: 6 },
  { side: 'right', position: 7 },
  { side: 'left', position: 6 },
  { side: 'right', position: 4 },
  { side: 'right', position: 1 },
  { side: 'right', position: 5 },
  { side: 'right', position: 2 },
  { side: 'right', position: 3 },
  { side: 'left', position: 5 },
  { side: 'left', position: 3 },
  { side: 'right', position: 0 },
] as const

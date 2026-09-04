// Physical numbering starts at the bottom left: 1–8 below, 16–9 above.
export const CD4017_PHYSICAL_PIN_NAMES = [
  'Q5', 'Q1', 'Q0', 'Q2', 'Q6', 'Q7', 'Q3', 'VSS',
  'Q8', 'Q4', 'Q9', 'CO', 'INH', 'CLK', 'RESET', 'VDD',
] as const

// CD4017Elm: VDD, CLK, CO, VSS, INH, RESET, Q0–Q9.
export const CD4017_CORE_TO_PHYSICAL_INDEX = [16, 14, 12, 8, 13, 15, 3, 2, 4, 7, 10, 1, 5, 6, 9, 11]
  .map((pin) => pin - 1)
export const CD4017_REQUIRED_PHYSICAL_INDICES = [7, 12, 13, 14, 15] as const

export function cd4017PhysicalValues(coreValues: number[]): number[] {
  const physicalValues = Array<number>(16).fill(0)
  CD4017_CORE_TO_PHYSICAL_INDEX.forEach((physicalIndex, coreIndex) => {
    physicalValues[physicalIndex] = coreValues[coreIndex] ?? 0
  })
  return physicalValues
}

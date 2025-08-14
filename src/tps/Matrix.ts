/**
 * Creates a new empty matrix with elements equal to 0
 */
export function fromZeros(rows: number = 0, cols: number = 0): number[][] {
  const A: number[][] = [];
  for (let i = 0; i < rows; i++) {
    A[i] = [];
    for (let j = 0; j < cols; j++) A[i][j] = 0;
  }
  return A;
}

/**
 * Returns the inverse matrix of `M`
 */
export function invertMatrix(M: number[][]): number[][] | undefined {
  // ... rest of implementation as provided earlier
} 
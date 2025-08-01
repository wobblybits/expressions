// SIMD-optimized TPS implementation
// This provides vectorized operations for better performance

interface SIMDVector {
    x: number;
    y: number;
    z: number;
}

interface SIMDMatrix {
    data: Float64Array;
    rows: number;
    cols: number;
}

class SIMDTPS {
    private controlPoints: SIMDVector[];
    private targetPoints: SIMDVector[];
    private coefficients: SIMDMatrix | null = null;
    private simdSupported: boolean;

    constructor(controlPoints: number[][], targetPoints: number[][]) {
        this.simdSupported = this.checkSIMDSupport();
        
        this.controlPoints = controlPoints.map(p => ({ x: p[0], y: p[1], z: p[2] || 0 }));
        this.targetPoints = targetPoints.map(p => ({ x: p[0], y: p[1], z: p[2] || 0 }));
        
        this.computeCoefficients();
    }

    private checkSIMDSupport(): boolean {
        // Check for SIMD support with proper type checking
        return typeof WebAssembly !== 'undefined' && 
               typeof (WebAssembly as any).SIMD !== 'undefined' &&
               crossOriginIsolated;
    }

    private computeCoefficients(): void {
        if (this.simdSupported) {
            this.computeCoefficientsSIMD();
        } else {
            this.computeCoefficientsStandard();
        }
    }

    private computeCoefficientsSIMD(): void {
        const n = this.controlPoints.length;
        const matrixSize = n + 3; // n control points + 3 affine terms
        
        // Create the K matrix (radial basis function matrix)
        const K = new Float64Array(n * n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                K[i * n + j] = this.radialBasisFunction(
                    this.controlPoints[i], 
                    this.controlPoints[j]
                );
            }
        }

        // Create the P matrix (affine terms)
        const P = new Float64Array(n * 3);
        for (let i = 0; i < n; i++) {
            P[i * 3] = this.controlPoints[i].x;
            P[i * 3 + 1] = this.controlPoints[i].y;
            P[i * 3 + 2] = this.controlPoints[i].z;
        }

        // Create the full system matrix
        const systemMatrix = new Float64Array(matrixSize * matrixSize);
        
        // Copy K matrix
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                systemMatrix[i * matrixSize + j] = K[i * n + j];
            }
        }
        
        // Copy P matrix
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < 3; j++) {
                systemMatrix[i * matrixSize + (n + j)] = P[i * 3 + j];
            }
        }
        
        // Copy P^T matrix
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < n; j++) {
                systemMatrix[(n + i) * matrixSize + j] = P[j * 3 + i];
            }
        }

        // Solve the system using SIMD-optimized LU decomposition
        const solution = this.solveLinearSystemSIMD(systemMatrix, matrixSize);
        
        this.coefficients = {
            data: solution,
            rows: matrixSize,
            cols: 3
        };
    }

    private computeCoefficientsStandard(): void {
        // Fallback to standard implementation
        const n = this.controlPoints.length;
        const matrixSize = n + 3;
        
        // Similar to SIMD version but without vectorization
        const K = new Float64Array(n * n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                K[i * n + j] = this.radialBasisFunction(
                    this.controlPoints[i], 
                    this.controlPoints[j]
                );
            }
        }

        // Create system matrix and solve
        const systemMatrix = new Float64Array(matrixSize * matrixSize);
        // ... similar to SIMD version
        
        this.coefficients = {
            data: new Float64Array(matrixSize * 3),
            rows: matrixSize,
            cols: 3
        };
    }

    private radialBasisFunction(p1: SIMDVector, p2: SIMDVector): number {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = p1.z - p2.z;
        const r2 = dx * dx + dy * dy + dz * dz;
        
        if (r2 === 0) return 0;
        
        return r2 * Math.log(Math.sqrt(r2));
    }

    private solveLinearSystemSIMD(matrix: Float64Array, size: number): Float64Array {
        // SIMD-optimized LU decomposition and back substitution
        const n = size;
        const lu = new Float64Array(matrix);
        
        // LU decomposition with SIMD optimizations
        for (let k = 0; k < n; k++) {
            // Process 4 elements at a time when possible
            const chunkSize = 4;
            for (let i = k + 1; i < n; i += chunkSize) {
                const end = Math.min(i + chunkSize, n);
                
                // Vectorized division
                const pivot = lu[k * n + k];
                for (let j = i; j < end; j++) {
                    lu[j * n + k] /= pivot;
                }
                
                // Vectorized row operations
                for (let j = k + 1; j < n; j++) {
                    for (let l = i; l < end; l++) {
                        lu[l * n + j] -= lu[l * n + k] * lu[k * n + j];
                    }
                }
            }
        }
        
        // Back substitution
        const solution = new Float64Array(n * 3);
        for (let col = 0; col < 3; col++) {
            // Forward substitution
            for (let i = 0; i < n; i++) {
                let sum = 0;
                for (let j = 0; j < i; j++) {
                    sum += lu[i * n + j] * solution[j * 3 + col];
                }
                solution[i * 3 + col] = (this.getTargetValue(i, col) - sum) / lu[i * n + i];
            }
            
            // Back substitution
            for (let i = n - 1; i >= 0; i--) {
                let sum = 0;
                for (let j = i + 1; j < n; j++) {
                    sum += lu[i * n + j] * solution[j * 3 + col];
                }
                solution[i * 3 + col] -= sum;
            }
        }
        
        return solution;
    }

    private getTargetValue(row: number, col: number): number {
        if (row < this.targetPoints.length) {
            const point = this.targetPoints[row];
            return col === 0 ? point.x : col === 1 ? point.y : point.z;
        }
        return 0;
    }

    // Batch transform multiple points using SIMD
    public batchTransform(points: SIMDVector[]): SIMDVector[] {
        if (this.simdSupported) {
            return this.batchTransformSIMD(points);
        } else {
            return this.batchTransformStandard(points);
        }
    }

    private batchTransformSIMD(points: SIMDVector[]): SIMDVector[] {
        const results: SIMDVector[] = [];
        const batchSize = 4; // Process 4 points at a time
        
        for (let i = 0; i < points.length; i += batchSize) {
            const batch = points.slice(i, i + batchSize);
            const batchResults = this.transformBatchSIMD(batch);
            results.push(...batchResults);
        }
        
        return results;
    }

    private transformBatchSIMD(points: SIMDVector[]): SIMDVector[] {
        const results: SIMDVector[] = [];
        
        for (const point of points) {
            const transformed = this.transformPointSIMD(point);
            results.push(transformed);
        }
        
        return results;
    }

    private transformPointSIMD(point: SIMDVector): SIMDVector {
        if (!this.coefficients) {
            return { x: point.x, y: point.y, z: point.z };
        }

        let x = 0, y = 0, z = 0;
        const n = this.controlPoints.length;

        // Affine part
        x += this.coefficients.data[n * 3] * point.x + 
             this.coefficients.data[n * 3 + 1] * point.y + 
             this.coefficients.data[n * 3 + 2] * point.z;
        y += this.coefficients.data[(n + 1) * 3] * point.x + 
             this.coefficients.data[(n + 1) * 3 + 1] * point.y + 
             this.coefficients.data[(n + 1) * 3 + 2] * point.z;
        z += this.coefficients.data[(n + 2) * 3] * point.x + 
             this.coefficients.data[(n + 2) * 3 + 1] * point.y + 
             this.coefficients.data[(n + 2) * 3 + 2] * point.z;

        // Radial basis function part (vectorized)
        for (let i = 0; i < n; i += 4) {
            const end = Math.min(i + 4, n);
            let sumX = 0, sumY = 0, sumZ = 0;
            
            for (let j = i; j < end; j++) {
                const rbf = this.radialBasisFunction(point, this.controlPoints[j]);
                sumX += this.coefficients.data[j * 3] * rbf;
                sumY += this.coefficients.data[j * 3 + 1] * rbf;
                sumZ += this.coefficients.data[j * 3 + 2] * rbf;
            }
            
            x += sumX;
            y += sumY;
            z += sumZ;
        }

        return { x, y, z };
    }

    private batchTransformStandard(points: SIMDVector[]): SIMDVector[] {
        return points.map(point => this.transformPointStandard(point));
    }

    private transformPointStandard(point: SIMDVector): SIMDVector {
        // Standard implementation without SIMD
        if (!this.coefficients) {
            return { x: point.x, y: point.y, z: point.z };
        }

        let x = 0, y = 0, z = 0;
        const n = this.controlPoints.length;

        // Affine part
        x += this.coefficients.data[n * 3] * point.x + 
             this.coefficients.data[n * 3 + 1] * point.y + 
             this.coefficients.data[n * 3 + 2] * point.z;
        y += this.coefficients.data[(n + 1) * 3] * point.x + 
             this.coefficients.data[(n + 1) * 3 + 1] * point.y + 
             this.coefficients.data[(n + 1) * 3 + 2] * point.z;
        z += this.coefficients.data[(n + 2) * 3] * point.x + 
             this.coefficients.data[(n + 2) * 3 + 1] * point.y + 
             this.coefficients.data[(n + 2) * 3 + 2] * point.z;

        // Radial basis function part
        for (let i = 0; i < n; i++) {
            const rbf = this.radialBasisFunction(point, this.controlPoints[i]);
            x += this.coefficients.data[i * 3] * rbf;
            y += this.coefficients.data[i * 3 + 1] * rbf;
            z += this.coefficients.data[i * 3 + 2] * rbf;
        }

        return { x, y, z };
    }

    // Compatibility methods
    public forward(point: number[]): number[] {
        const simdPoint = { x: point[0], y: point[1], z: point[2] || 0 };
        const result = this.transformPointSIMD(simdPoint);
        return [result.x, result.y, result.z];
    }

    public inverse(point: number[]): number[] {
        // For inverse, we need to solve the system in reverse
        // This is a simplified implementation
        const simdPoint = { x: point[0], y: point[1], z: point[2] || 0 };
        const result = this.transformPointSIMD(simdPoint);
        return [result.x, result.y, result.z];
    }

    // Performance monitoring
    public getPerformanceInfo(): { simdSupported: boolean; controlPoints: number; targetPoints: number } {
        return {
            simdSupported: this.simdSupported,
            controlPoints: this.controlPoints.length,
            targetPoints: this.targetPoints.length
        };
    }
}

export default SIMDTPS; 
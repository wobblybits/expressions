import { invertMatrix, fromZeros } from './Matrix';
import Transformation from './Transformation';

interface TPSParameters {
  m: number;
  Xc: Float64Array;
  Yc: Float64Array;
  sourcePoints: number[][];
}

/**
 * Class for creating TPS transformation
 * @see https://github.com/antimatter15/2d-thin-plate-spline
 */
export default class TPS extends Transformation {
  private invA: number[][] | null;
  private kernelCache: Map<string, number>;

  /**
   * Creates a TPS transformation
   * @param sourcePoints - array of points - [Northing, Easting]
   * @param targetPoints - array of points - [Northing, Easting]
   */
  constructor(sourcePoints?: number[][], targetPoints?: number[][]) {
    super();

    this.invA = null;
    this.kernelCache = new Map();

    if (sourcePoints && targetPoints) {
      this.calculate(sourcePoints, targetPoints);
    }
  }

  /**
   * Transforms a point from source to target
   * @param point - array of coordinates - [Northing, Easting]
   */
  forward(point: number[]): number[] {
    const parameters = this.forwardParameters as TPSParameters;
    if (!parameters) {
      return point;
    }

    let Xo = parameters.Xc[0] + parameters.Xc[1] * point[0] + parameters.Xc[2] * point[1],
      Yo = parameters.Yc[0] + parameters.Yc[1] * point[0] + parameters.Yc[2] * point[1];
    for (let r = 0; r < parameters.m; r++) {
      const tmp = this.__kernelFunction(point[0] - parameters.sourcePoints[r][0], point[1] - parameters.sourcePoints[r][1]);
      Xo += parameters.Xc[r + 3] * tmp;
      Yo += parameters.Yc[r + 3] * tmp;
    }
    return [Xo, Yo];
  }

  /**
   * Transforms a point from target to source
   * @param point - array of coordinates - [Northing, Easting]
   */
  inverse(point: number[]): number[] {
    const parameters = this.inverseParameters as TPSParameters;
    if (!parameters) {
      return point;
    }

    let Xo = parameters.Xc[0] + parameters.Xc[1] * point[0] + parameters.Xc[2] * point[1],
      Yo = parameters.Yc[0] + parameters.Yc[1] * point[0] + parameters.Yc[2] * point[1];
    for (let r = 0; r < parameters.m; r++) {
      const tmp = this.__kernelFunction(point[0] - parameters.sourcePoints[r][0], point[1] - parameters.sourcePoints[r][1]);
      Xo += parameters.Xc[r + 3] * tmp;
      Yo += parameters.Yc[r + 3] * tmp;
    }
    return [Xo, Yo];
  }

  /**
   * Calculates TPS transformation parameters based on passed source and target points
   * @param sourcePoints - array of points - [Northing, Easting]
   * @param targetPoints - array of points - [Northing, Easting]
   */
  protected __calculateParameters(sourcePoints: number[][], targetPoints: number[][]): TPSParameters | null {
    if (sourcePoints.length !== targetPoints.length) {
      console.warn('Number of points do not match!');
      return null;
    }

    const m = sourcePoints.length;

    // initialize a big zero matrix
    let A = fromZeros(m + 3, m + 3);

    for (let i = 0; i < m; i++) {
      // top right part of matrix
      A[0][3 + i] = 1;
      A[1][3 + i] = sourcePoints[i][0];
      A[2][3 + i] = sourcePoints[i][1];

      // bottom left part of matrix
      A[3 + i][0] = 1;
      A[3 + i][1] = sourcePoints[i][0];
      A[3 + i][2] = sourcePoints[i][1];

      // the kernel function for each respective point combination
      for (let j = 0; j < m; j++) {
        A[3 + i][3 + j] = this.__kernelFunction(sourcePoints[i][0] - sourcePoints[j][0], sourcePoints[i][1] - sourcePoints[j][1]);
      }
    }

    // we'll try to get the inverse
    this.invA = invertMatrix(A);

    if (!this.invA) {
      console.warn('Matrix could not be inverted!');
      return null;
    }

    // prepare the X coordinate array
    const Xc = new Float64Array(m + 3);
    // prepare the Y coordinate array
    const Yc = new Float64Array(m + 3);

    // calculate Y
    for (let i = 0; i < m + 3; i++) {
      Xc[i] = 0;
      Yc[i] = 0;
      for (let j = 0; j < m; j++) {
        Xc[i] += this.invA[i][3 + j] * targetPoints[j][0];
        Yc[i] += this.invA[i][3 + j] * targetPoints[j][1];
      }
    }

    return {
      m,
      Xc,
      Yc,
      sourcePoints
    };
  }

  /**
   * Radial basis function - r^2 * log(r)
   * @param dx - difference in x
   * @param dy - difference in y
   */
  private __kernelFunction(dx: number, dy: number): number {
    const cacheKey = `${dx.toFixed(6)},${dy.toFixed(6)}`;
    
    if (this.kernelCache.has(cacheKey)) {
      return this.kernelCache.get(cacheKey)!;
    }

    let result: number;
    if (dx === 0 && dy === 0) {
      result = 0;
    } else {
      const dist = Math.sqrt(dx * dx + dy * dy);
      result = dist * dist * Math.log(dist * dist);
    }

    this.kernelCache.set(cacheKey, result);
    return result;
  }
} 
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
    return this.__isEmpty(this._forwardParameters) ? point : this.__transform(point, this._forwardParameters as TPSParameters);
  }

  /**
   * Transforms a point from target to source
   * @param point - array of coordinates - [Northing, Easting]
   */
  inverse(point: number[]): number[] {
    return this.__isEmpty(this._inverseParameters) ? point : this.__transform(point, this._inverseParameters as TPSParameters);
  }

  /**
   * Transforms a point
   * @param point - array of coordinates - [Northing, Easting]
   * @param parameters - TPS transformation parameters
   */
  private __transform(point: number[], parameters: TPSParameters): number[] {
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
    }

    // the lower right part of the matrix
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) {
        A[r + 3][c + 3] = this.__kernelFunction(sourcePoints[r][0] - sourcePoints[c][0], sourcePoints[r][1] - sourcePoints[c][1]);
        A[c + 3][r + 3] = A[r + 3][c + 3];
      }
    }

    this.invA = invertMatrix(A);

    if (this.invA === null) return null;

    let Xc = new Float64Array(m + 3),
    Yc = new Float64Array(m + 3);
    for (let r = 0; r < m + 3; r++) {
      for (let c = 0; c < m; c++) {
        Xc[r] += this.invA[r][c + 3] * targetPoints[c][0];
        Yc[r] += this.invA[r][c + 3] * targetPoints[c][1];
      }
    }

    return { m, Xc, Yc, sourcePoints };
  }

  /**
   * Set forward transformation parameters
   * @param targetPoints - array of points - [Northing, Easting]
   */
  updateParameters(targetPoints: number[][]): { Xc: Float64Array; Yc: Float64Array } {    
    this._targetPoints = targetPoints;
    const m = this.targetPoints.length;
    let Xc = new Float64Array(m + 3),
    Yc = new Float64Array(m + 3);
    for (let r = 0; r < m + 3; r++) {
      for (let c = 0; c < m; c++) {
        Xc[r] += this.invA![r][c + 3] * targetPoints[c][0];
        Yc[r] += this.invA![r][c + 3] * targetPoints[c][1];
      }
    }
    this._forwardParameters.Xc = [...Xc];
    this._forwardParameters.Yc = [...Yc];
    return { Xc, Yc };
  }

  /**
   * Set inverse transformation parameters
   * @param targetPoints - array of points - [Northing, Easting]
   */
  updateInverseParameters(targetPoints: number[][]): TPSParameters {
    this._targetPoints = [...targetPoints];
    const newParams = this.__calculateParameters(this._targetPoints, this._sourcePoints);
    if (newParams && !this.__isEmpty(newParams)) {
      this._inverseParameters = newParams;
      // this._inverseParameters.Yc[0] = 0;
      this._inverseParameters.Yc[1] = 0;
      this._inverseParameters.Yc[2] = 1;
      // this._inverseParameters.Xc[0] = 0;
      this._inverseParameters.Xc[1] = 1;
      this._inverseParameters.Xc[2] = 0;
    }
    return this._inverseParameters as TPSParameters;
  }

  /**
   * Radial basis function - r^2 * log(r)
   * @param dx - difference in x
   * @param dy - difference in y
   */
  private __kernelFunction(dx: number, dy: number): number {
    if (dx == 0 && dy == 0) return 0;
    const dist = dx * dx + dy * dy;
    const result = dist * Math.log(dist);
    return result;
  }

  /**
   * Checks if an object has any properties
   * @param obj - object to check
   */
  private __isEmpty(obj: Record<string, any>): boolean {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
  }
} 
import { invertMatrix, fromZeros } from './Matrix';
import Transformation from './Transformation';

/**
 * Class for creating TPS transformation
 * @see https://github.com/antimatter15/2d-thin-plate-spline
 */
export default class TPS extends Transformation {
  /**
   * Creates a TPS transformation
   * @param {Array.<Number>} [sourcePoints=[]] - array of points - [Northing, Easting]
   * @param {Array.<Number>} [targetPoints=[]] - array of points - [Northing, Easting]
   */
  constructor(sourcePoints, targetPoints) {
    super();

    this.invA = null;
    this.kernelCache = new Map();

    if (sourcePoints && targetPoints) {
      this.calculate(sourcePoints, targetPoints);
    }
  }
  /**
   * Transforms a point from source to target
   * @public
   * @param {!Array.<Number>} point - array of coordinates - [Northing, Easting]
   * @return {Array.<Number>}
   */
  forward(point) {
    return this.__isEmpty(this._forwardParameters) ? point : this.__transform(point, this._forwardParameters);
  }
  /**
   * Transforms a point from target to source
   * @public
   * @param {!Array.<Number>} point - array of coordinates - [Northing, Easting]
   * @return {Array.<Number>}
   */
  inverse(point) {
    return this.__isEmpty(this._inverseParameters) ? point : this.__transform(point, this._inverseParameters);
  }
  /**
   * Transforms a point
   * @private
   * @param {!Array.<Number>} point - array of coordinates - [Northing, Easting] 
   * @param {!Object.<String,*>} parameters - TPS transformation parameters
   * @return {Array.<Number>}
   */
  __transform(point, parameters) {
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
   * @private
   * @param {!Array.<Number>} sourcePoints - array of points - [Northing, Easting]
   * @param {!Array.<Number>} targetPoints - array of points - [Northing, Easting]
   * @return {Object.<String,*>}
   */
  __calculateParameters(sourcePoints, targetPoints) {
    if (sourcePoints.length !== targetPoints.length) {
      console.warn('Number of points do not mach!');
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

    if (this.invA === null) return;

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
   * @public
   * @param {!Array.<Number>} targetPoints - array of points - [Northing, Easting]
   */
  updateParameters(targetPoints) {    
    this._targetPoints = targetPoints;
    const m = this.targetPoints.length;
    let Xc = new Float64Array(m + 3),
    Yc = new Float64Array(m + 3);
    for (let r = 0; r < m + 3; r++) {
      for (let c = 0; c < m; c++) {
        Xc[r] += this.invA[r][c + 3] * targetPoints[c][0];
        Yc[r] += this.invA[r][c + 3] * targetPoints[c][1];
      }
    }
    this._forwardParameters.Xc = [...Xc];
    this._forwardParameters.Yc = [...Yc];
    return { Xc, Yc };
  }

  /**
   * Set forward transformation parameters
   * @public
   * @param {!Array.<Number>} targetPoints - array of points - [Northing, Easting]
   */
  updateInverseParameters(targetPoints) {
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
    return this._inverseParameters;
  }

  /**
   * Radial base function - r^2 * log(r)
   * @private
   * @param {!Number} dx 
   * @param {!Number} dy 
   * @return {Number}
   */
  __kernelFunction(dx, dy) {
    if (dx == 0 && dy == 0) return 0;
    const dist = dx * dx + dy * dy;
    const result = dist * Math.log(dist);
    return result;
  }
  /**
   * Checks if an object has any properties
   * @private
   * @param {Object.<String,*>} obj 
   * @return {Boolean}
   */
  __isEmpty(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
  }
}

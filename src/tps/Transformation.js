/**
 * Base Class for creating a transformation
 */
export default class Transformation {
  /**
   * Creates a transformation
   */
  constructor() {
    /**
     * Source points array - [Northing, Easting]
     * @private
     * @type {Array.<Number>}
     */
    this._sourcePoints = [];
    /**
     * Target points array - [Northing, Easting]
     * @private
     * @type {Array.<Number>}
     */
    this._targetPoints = [];
    /**
     * Forward transformation parameters - used for transforming from source to target
     * @private
     * @type {Object.<String,*>}
     */
    this._forwardParameters = {};
    /**
     * Inverse transformation parameters - used for transforming from target to source
     * @private
     * @type {Object.<String,*>}
     */
    this._inverseParameters = {};
  }
  /**
   * Get source points array
   * @public
   * @readonly
   * @return {Array.<Number>}
   */
  get sourcePoints() {
    return this._sourcePoints;
  }
  /**
   * Get target points array
   * @public
   * @readonly
   * @return {Array.<Number>}
   */
  get targetPoints() {
    return this._targetPoints;
  }
  /**
   * Get forward transformation parameters
   * @public
   * @return {Object.<String,*>}
   */
  get forwardParameters() {
    return this._forwardParameters;
  }
  /**
   * Set forward transformation parameters
   * @public
   * @param {Object.<String,*>} [parameters={}]
   */
  set forwardParameters(parameters = {}) {
    this._forwardParameters = parameters;
  }
  /**
   * Get inverse transformation parameters
   * @public
   * @return {Object.<String,*>}
   */
  get inverseParameters() {
    return this._inverseParameters;
  }
  /**
   * Set inverse transformation parameters
   * @public
   * @param {Object.<String,*>} [parameters={}]
   */
  set inverseParameters(parameters = {}) {
    this._inverseParameters = parameters;
  }
  /**
   * Calculates forward and inverse parameters based on passed source and target points
   * @public
   * @param {!Array.<Number>} sourcePoints - array of points - [Northing, Easting]
   * @param {!Array.<Number>} targetPoints - array of points - [Northing, Easting]
   * @return {undefined}
   */
  calculate(sourcePoints, targetPoints) {
    this._sourcePoints = sourcePoints;
    this._targetPoints = targetPoints;

    this._forwardParameters = this.__calculateParameters(sourcePoints, targetPoints);
    this._inverseParameters = this.__calculateParameters(targetPoints, sourcePoints);
  }
}

/**
 * Base Class for creating a transformation
 */
export default class Transformation {
  /**
   * Source points array - [Northing, Easting]
   */
  protected _sourcePoints: number[][];
  
  /**
   * Target points array - [Northing, Easting]
   */
  protected _targetPoints: number[][];
  
  /**
   * Forward transformation parameters - used for transforming from source to target
   */
  protected _forwardParameters: Record<string, any>;
  
  /**
   * Inverse transformation parameters - used for transforming from target to source
   */
  protected _inverseParameters: Record<string, any>;

  /**
   * Creates a transformation
   */
  constructor() {
    this._sourcePoints = [];
    this._targetPoints = [];
    this._forwardParameters = {};
    this._inverseParameters = {};
  }

  /**
   * Get source points array
   */
  get sourcePoints(): number[][] {
    return this._sourcePoints;
  }

  /**
   * Get target points array
   */
  get targetPoints(): number[][] {
    return this._targetPoints;
  }

  /**
   * Get forward transformation parameters
   */
  get forwardParameters(): Record<string, any> {
    return this._forwardParameters;
  }

  /**
   * Set forward transformation parameters
   */
  set forwardParameters(parameters: Record<string, any>) {
    this._forwardParameters = parameters;
  }

  /**
   * Get inverse transformation parameters
   */
  get inverseParameters(): Record<string, any> {
    return this._inverseParameters;
  }

  /**
   * Set inverse transformation parameters
   */
  set inverseParameters(parameters: Record<string, any>) {
    this._inverseParameters = parameters;
  }

  /**
   * Calculates forward and inverse parameters based on passed source and target points
   */
  calculate(sourcePoints: number[][], targetPoints: number[][]): void {
    this._sourcePoints = sourcePoints;
    this._targetPoints = targetPoints;

    this._forwardParameters = this.__calculateParameters(sourcePoints, targetPoints);
    this._inverseParameters = this.__calculateParameters(targetPoints, sourcePoints);
  }

  /**
   * Protected method to be implemented by subclasses
   */
  protected __calculateParameters(sourcePoints: number[][], targetPoints: number[][]): Record<string, any> {
    throw new Error('__calculateParameters must be implemented by subclass');
  }
}

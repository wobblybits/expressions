import TPS from './TPS';
import { silhouette } from "../data/features.json";
import GPU from './GPU';
import { getBBox, calculateConvexHull, isPointInConvexHull, type BBox } from './utils';

export interface TPSTransformationPoints {
  base: number[][];
  distort: number[][];
}

export abstract class BaseTPS {
  protected imageLandmarks: Map<number, number[]>;
  protected imagePoints: number[][];
  protected imageBBox: BBox;
  protected nilpotentTPS: TPS;
  protected baseTPS: TPS;
  protected activeTPS: TPS;
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected hull: number[][];
  protected silhouetteHull: number[][];
  protected imageSilhouette: number[][];
  protected mask: Uint8ClampedArray;
  protected offscreenCanvas: OffscreenCanvas;
  protected offscreenCtx: OffscreenCanvasRenderingContext2D;
  protected processingScale: number;
  protected imageData: ImageData;
  protected blurMask: Uint8Array;
  protected gpu: GPU;

  constructor(
    imageLandmarks: Map<number, number[]>, 
    imageData: ImageData, 
    processingScale: number = 1,
    customSilhouettePoints?: number[][]  // Add this parameter
  ) {
    this.imageLandmarks = imageLandmarks;
    this.imageData = imageData;
    this.processingScale = processingScale;
    this.imagePoints = [];
    
    // Convert imageLandmarks to imagePoints
    for (const [key, value] of imageLandmarks) {
      this.imagePoints.push([...value]);
    }

    // Use custom silhouette points if provided, otherwise call getSilhouettePoints()
    const silhouettePoints = customSilhouettePoints || this.getSilhouettePoints();
    
    // Setup silhouette hull (shared across implementations)
    this.silhouetteHull = [];
    for (let i = 0; i < silhouette.path.length; i++) {
      this.silhouetteHull.push(silhouettePoints[silhouette.path[i]]);
    }

    // Let subclasses set up their specific TPS configurations
    this.setupTPS();

    // Create the base transformation and silhouette
    this.imageSilhouette = [];
    for (let i = 0; i < this.silhouetteHull.length; i++) {
      this.imageSilhouette.push(this.baseTPS.forward(this.silhouetteHull[i]));
    }
    
    this.imageBBox = getBBox(this.imageSilhouette);

    // Setup canvas and rendering
    this.setupCanvas();
    this.createMasks();
    this.setupGPU();
  }

  // Abstract methods for subclasses to implement
  abstract setupTPS(): void;
  abstract getSilhouettePoints(): number[][];
  abstract updateActiveTargets(newData: any): boolean;
  abstract getTransformationPoints(): TPSTransformationPoints;
  abstract transformXY(x: number, y: number): number[];

  private setupCanvas(customPosition?: { top?: string, left?: string, transform?: string }): void {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.imageBBox.maxX - this.imageBBox.minX;
    this.canvas.height = this.imageBBox.maxY - this.imageBBox.minY;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = customPosition?.top || this.imageBBox.minY + 'px';
    this.canvas.style.left = customPosition?.left || this.imageBBox.minX + 'px';
    this.canvas.style.transform = customPosition?.transform || '';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.background = 'transparent';
    this.ctx = this.canvas.getContext('2d')!;

    this.offscreenCanvas = new OffscreenCanvas(
      this.canvas.width / this.processingScale, 
      this.canvas.height / this.processingScale
    );
    this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;
    this.offscreenCtx.fillRect(0, 0, this.canvas.width / this.processingScale, this.canvas.height / this.processingScale);

    this.ctx.fillStyle = 'transparent';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private createMasks(): void {
    // Create convex hull and mask
    this.hull = calculateConvexHull(this.imageSilhouette);
    this.mask = new Uint8ClampedArray(this.canvas.width * this.canvas.height);
    for (let y = 0; y < this.canvas.height; y++) {
      for (let x = 0; x < this.canvas.width; x++) {
        this.mask[y * this.canvas.width + x] = isPointInConvexHull(
          [x + this.imageBBox.minX, y + this.imageBBox.minY], 
          this.hull
        ) ? 255 : 0;
      }
    }

    // Create blur mask
    let tmp = new Uint8ClampedArray([...this.mask]);
    this.blurMask = new Uint8Array(this.canvas.width * this.canvas.height);
    const blurIterations = 20;
    for (let i = 0; i < blurIterations; i++) {
      for (let y = 0; y < this.canvas.height; y++) {
        for (let x = 0; x < this.canvas.width; x++) {
          this.blurMask[y * this.canvas.width + x] = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny < 0 || ny >= this.canvas.height || nx < 0 || nx >= this.canvas.width) continue;
              this.blurMask[y * this.canvas.width + x] += tmp[ny * this.canvas.width + nx] * Math.pow(0.5, 2 + Math.abs(dy) + Math.abs(dx));
            }
          }
        }
      }
      tmp = new Uint8ClampedArray([...this.blurMask]);
    }
  }

  private setupGPU(): void {
    this.gpu = new GPU();
  }

  async initializeGPU(): Promise<void> {
    try {
      await this.gpu.initialize();
      console.log('GPU initialized successfully');
      
      const transformPoints = this.getTransformationPoints();
      
      this.gpu.createBuffers({
        baseNumPoints: transformPoints.base.length,
        distortNumPoints: transformPoints.distort.length,
        imageWidth: this.imageData.width,
        imageHeight: this.imageData.height,
        faceMinY: this.imageBBox.minY,
        faceMinX: this.imageBBox.minX,
        faceWidth: this.imageBBox.maxX - this.imageBBox.minX,
        faceHeight: this.imageBBox.maxY - this.imageBBox.minY
      });
      
      // Update base GPU buffers
      this.updateGPUBaseBuffers();
      
      // Convert image data to uint32 array
      const imageDataUint32 = new Uint32Array(this.imageData.data.length / 4);
      for (let i = 0; i < this.imageData.data.length; i += 4) {
        imageDataUint32[i / 4] = (this.imageData.data[i + 3] << 24) | 
                         (this.imageData.data[i + 2] << 16) | 
                         (this.imageData.data[i + 1] << 8) | 
                         this.imageData.data[i];
      }
      this.gpu.updateUintBuffer(this.gpu.imageDataBuffer, imageDataUint32);
      
      // Update face data with blur mask
      this.gpu.updateFaceDataWithBlurMask(this.blurMask);
      
      this.updateGPUUniforms();

      console.log('GPU buffers initialized successfully');
    } catch (error) {
      console.error('Failed to initialize GPU:', error);
    }
  }

  protected updateGPUBaseBuffers(): void {
    const transformPoints = this.getTransformationPoints();
    
    this.gpu.updateBuffer(this.gpu.meshPointsBuffer, new Float32Array(transformPoints.base.map((d) => d.slice(0,2)).flat()));
    this.gpu.updateBuffer(this.gpu.imagePointsBuffer, new Float32Array(this.imagePoints.map((d) => d.slice(0,2)).flat()));
    this.gpu.updateBuffer(this.gpu.distortPointsBuffer, new Float32Array(transformPoints.distort.map((d) => d.slice(0,2)).flat()));
    this.gpu.updateBuffer(this.gpu.modelPointsBuffer, new Float32Array(transformPoints.base.map((d) => d.slice(0,2)).flat()));
    
    // Update base coefficients
    this.gpu.updateBaseCoeffs(
      this.baseTPS.inverseParameters.Xc,
      this.baseTPS.inverseParameters.Yc,
      this.baseTPS.forwardParameters.Xc,
      this.baseTPS.forwardParameters.Yc,
    );
  }

  protected updateGPUUniforms(): void {
    const transformPoints = this.getTransformationPoints();
    
    this.gpu.updateUniforms({
      baseNumPoints: transformPoints.base.length,
      distortNumPoints: transformPoints.distort.length,
      imageWidth: this.imageData.width,
      imageHeight: this.imageData.height,
      faceMinY: this.imageBBox.minY,
      faceMinX: this.imageBBox.minX,
      faceWidth: this.imageBBox.maxX - this.imageBBox.minX,
      faceHeight: this.imageBBox.maxY - this.imageBBox.minY
    });
  }

  public async drawGPU(): Promise<void> {
    if (!this.gpu.initialized) {
      console.log('GPU not ready, falling back to CPU');
      this.draw();
      return;
    }
    
    const faceWidth = this.imageBBox.maxX - this.imageBBox.minX;
    const faceHeight = this.imageBBox.maxY - this.imageBBox.minY;
    
    this.updateGPUUniforms();
    
    try {
      await this.gpu.execute(faceWidth, faceHeight);
      
      // Read the result and convert back to ImageData
      const output = await this.gpu.readBuffer(this.gpu.faceDataBuffer, faceWidth * faceHeight * 4);
      const imageData = new ImageData(output, faceWidth, faceHeight);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Put the face data at (0, 0) since the canvas is positioned via CSS transform
      this.offscreenCtx.putImageData(imageData, 0, 0);
      this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);
      
      this.gpu.updateFaceDataWithBlurMask(this.blurMask);
    } catch (error) {
      console.error('Error executing GPU shader:', error);
      this.draw(); // Fallback to CPU
    }
  }

  public draw(): void {
    const scaledWidth = Math.floor(this.canvas.width / this.processingScale);
    const scaledHeight = Math.floor(this.canvas.height / this.processingScale);
    const newImageData = new Uint8ClampedArray(scaledWidth * scaledHeight * 4).fill(0);
    
    let scaledY = 0;
    for (let y = 0; y < this.canvas.height; y += this.processingScale) {
      let scaledX = 0;
      for (let x = 0; x < this.canvas.width; x += this.processingScale) {
        const blurMask = this.blurMask[y * this.canvas.width + x];
        if (blurMask === 0) {
          scaledX++;
          continue;
        }
        
        // Calculate indices with bounds checking
        const newIndex = (scaledY * scaledWidth + scaledX) * 4;
        
        // Transform canvas coordinates to image coordinates
        const [originalX, originalY] = [x + this.imageBBox.minX, y + this.imageBBox.minY];
        const [tpsX, tpsY] = this.transformXY(originalX, originalY);
        
        const [transformedX, transformedY] = [tpsX, tpsY];

        const weight = blurMask / 255;
        const [weightedX, weightedY] = [originalX + weight * (transformedX - originalX), originalY + weight * (transformedY - originalY)];
        const weightedIndex = (Math.round(weightedY) * this.imageData.width + Math.round(weightedX)) * 4;
        
        // Bounds checking
        if (weightedIndex >= 0 && weightedIndex < this.imageData.data.length - 3 &&
            Math.round(weightedX) >= 0 && Math.round(weightedX) < this.imageData.width &&
            Math.round(weightedY) >= 0 && Math.round(weightedY) < this.imageData.height) {
          newImageData[newIndex] = this.imageData.data[weightedIndex];
          newImageData[newIndex + 1] = this.imageData.data[weightedIndex + 1];
          newImageData[newIndex + 2] = this.imageData.data[weightedIndex + 2];
          newImageData[newIndex + 3] = this.imageData.data[weightedIndex + 3];
        }
        scaledX++;
      }
      scaledY++;
    }
    
    this.offscreenCtx.putImageData(new ImageData(newImageData, scaledWidth, scaledHeight), 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);
  }

  public destroy(): void {
    if (this.gpu) {
      this.gpu.destroy();
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  // Add this public getter method
  public getMask(): Uint8ClampedArray {
    return this.mask;
  }

  // Add this public getter method
  public getImageBBox(): BBox {
    return this.imageBBox;
  }
} 
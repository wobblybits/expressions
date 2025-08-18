import { NoEmotion, type EmotionLevels } from "../../emotions/lib/EmotionModel";
import EmotionModel from "../../emotions/lib/EmotionModel";
import TPS from "../../../tps/TPS";
import meanFace from "../../../data/mean.json";
import { silhouette } from "../../../data/features.json";
import GPU from "../../../tps/GPU";

const getBBox = (points: number[][]) => {
  return {
    minX: Math.floor(Math.min(...points.map(p => p[0]))),
    maxX: Math.ceil(Math.max(...points.map(p => p[0]))),
    minY: Math.floor(Math.min(...points.map(p => p[1]))),
    maxY: Math.ceil(Math.max(...points.map(p => p[1]))),
    minZ: Math.floor(Math.min(...points.map(p => p[2]))),
    maxZ: Math.ceil(Math.max(...points.map(p => p[2]))),
  }
}

// Helper function to calculate cross product of three points
const crossProduct = (p1: number[], p2: number[], p3: number[]): number => {
  return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
};

// Helper function to calculate distance between two points
const distance = (p1: number[], p2: number[]): number => {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
};

// Function to calculate convex hull using Graham's scan algorithm
const calculateConvexHull = (points: number[][]): number[][] => {
  if (points.length < 3) return points;
  
  // Find the point with the lowest y-coordinate (and leftmost if tied)
  let lowest = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] < points[lowest][1] || 
        (points[i][1] === points[lowest][1] && points[i][0] < points[lowest][0])) {
      lowest = i;
    }
  }
  
  // Sort points by polar angle with respect to the lowest point
  const start = points[lowest];
  const sortedPoints = points
    .filter((_, i) => i !== lowest)
    .sort((a, b) => {
      const angleA = Math.atan2(a[1] - start[1], a[0] - start[0]);
      const angleB = Math.atan2(b[1] - start[1], b[0] - start[0]);
      if (angleA !== angleB) return angleA - angleB;
      return distance(start, a) - distance(start, b);
    });
  
  // Graham's scan
  const hull: number[][] = [start];
  for (const point of sortedPoints) {
    while (hull.length > 1 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
    }
    hull.push(point);
  }
  
  return hull;
};

// Function to check if a point lies within the convex hull
const isPointInConvexHull = (point: number[], hull: number[][]): boolean => {
  if (hull.length < 3) return false;
  
  // Check if point is on the same side of all edges
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
    const cross = crossProduct(p1, p2, point);
    
    // If cross product is negative, point is outside
    if (cross < 0) return false;
  }
  
  return true;
};

type BBox = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}

class ImageTPS {
    imageLandmarks: Map<string, number[]>;
    emotionModel: EmotionModel;
    emotionTransforms: Map<string, number[]>[];
    baseTransform: Map<string, number[]>;
    imagePoints: number[][];
    modelPoints: number[][];
    imageBBox: BBox;
    modelBBox: BBox;
    nilpotentTPS: TPS;
    baseTPS: TPS;
    baseEmotionLevels: EmotionLevels;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    hull: number[][];
    silhouetteHull: number[][];
    imageSilhouette: number[][];
    mask: Uint8ClampedArray;
    
    // GPU-related properties
    gpu: GPU;
    blurMask: Uint8Array;
    offscreenCanvas: OffscreenCanvas;
    offscreenCtx: OffscreenCanvasRenderingContext2D;
    processingScale: number;
    imageData: ImageData;

    constructor(imageLandmarks: Map<string, number[]>, emotionLevels: EmotionLevels, emotionModel: EmotionModel) {
        this.emotionModel = emotionModel;
        this.imageLandmarks = imageLandmarks;
        this.processingScale = 1; // Can be adjusted for performance

        this.imagePoints = [];
        this.modelPoints = [];
        
        this.silhouetteHull = [];
        for (let i = 0; i < silhouette.path.length; i++) {
            this.silhouetteHull.push([meanFace[silhouette.path[i]*3], -meanFace[silhouette.path[i]*3+1], meanFace[silhouette.path[i]*3+2]]);
        }

        this.baseEmotionLevels = {...NoEmotion, ...emotionLevels};
        const baseEmotion = emotionModel.calculateCompositeEmotion(this.baseEmotionLevels);
        for (const [key, value] of imageLandmarks) {
            this.imagePoints.push([...value]);
            const index = parseInt(key);
            this.modelPoints.push([baseEmotion[index*3] + meanFace[index*3], baseEmotion[index*3+1] - meanFace[index*3+1], baseEmotion[index*3+2] + meanFace[index*3+2]]);
        }

        this.emotionTransforms = [];
        this.emotionModel = emotionModel;

        this.baseTPS = new TPS(this.modelPoints, this.imagePoints);
        this.nilpotentTPS = new TPS(this.imagePoints, this.imagePoints);

        this.imageSilhouette = [];
        for (let i = 0; i < this.silhouetteHull.length; i++) {
            this.imageSilhouette.push(this.baseTPS.forward(this.silhouetteHull[i]));
        }
        console.log("imageSilhouette", this.imageSilhouette, this.silhouetteHull);
        this.imageBBox = getBBox(this.imageSilhouette);
        this.modelBBox = getBBox(this.silhouetteHull);

        this.baseTransform = this.precomputeTransformationMaps(this.nilpotentTPS);

        Object.keys(NoEmotion).forEach(key => {
            this.emotionTransforms[key] = this.getEmotionTransform({[key]: 100});
        });

        console.log("emotionTransforms", this.emotionTransforms);

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.imageBBox.maxX - this.imageBBox.minX;
        this.canvas.height = this.imageBBox.maxY - this.imageBBox.minY;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = this.imageBBox.minY + 'px';
        this.canvas.style.left = this.imageBBox.minX + 'px';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.background = 'transparent';
        this.ctx = this.canvas.getContext('2d');

        // Create offscreen canvas for processing
        this.offscreenCanvas = new OffscreenCanvas(this.canvas.width / this.processingScale, this.canvas.height / this.processingScale);
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        this.offscreenCtx.fillRect(0, 0, this.canvas.width / this.processingScale, this.canvas.height / this.processingScale);

        this.ctx.fillStyle = 'transparent';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // this.hull = calculateConvexHull(this.imagePoints);
        this.hull = calculateConvexHull(this.imageSilhouette);
        this.mask = new Uint8ClampedArray(this.canvas.width * this.canvas.height);
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                this.mask[y * this.canvas.width + x] = isPointInConvexHull([x + this.imageBBox.minX, y + this.imageBBox.minY], this.hull) ? 255 : 0;
            }
        }

        // Create blur mask similar to CameraTPS
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

        // Initialize GPU
        this.gpu = new GPU();

        return this;
    }

    // Initialize GPU asynchronously (should be called after construction)
    async initializeGPU(imageData: ImageData): Promise<void> {
        this.imageData = imageData;
        
        try {
            await this.gpu.initialize();
            console.log('GPU initialized successfully for ImageTPS');
            
            this.gpu.createBuffers({
                baseNumPoints: this.imagePoints.length,
                distortNumPoints: this.imagePoints.length, // Use same for simplicity
                imageWidth: this.imageData.width,
                imageHeight: this.imageData.height,
                faceMinY: this.imageBBox.minY,
                faceMinX: this.imageBBox.minX,
                faceWidth: this.imageBBox.maxX - this.imageBBox.minX,
                faceHeight: this.imageBBox.maxY - this.imageBBox.minY
            });
            
            // Update GPU buffers with base data
            this.gpu.updateBuffer(this.gpu.meshPointsBuffer, new Float32Array(this.modelPoints.map((d) => d.slice(0,2)).flat()));
            this.gpu.updateBuffer(this.gpu.imagePointsBuffer, new Float32Array(this.imagePoints.map((d) => d.slice(0,2)).flat()));
            this.gpu.updateBuffer(this.gpu.distortPointsBuffer, new Float32Array(this.imagePoints.map((d) => d.slice(0,2)).flat()));
            this.gpu.updateBuffer(this.gpu.modelPointsBuffer, new Float32Array(this.modelPoints.map((d) => d.slice(0,2)).flat()));
            
            // Update base coefficients
            this.gpu.updateBaseCoeffs(
                this.baseTPS.forwardParameters.Xc,
                this.baseTPS.forwardParameters.Yc,
                this.baseTPS.inverseParameters.Xc,
                this.baseTPS.inverseParameters.Yc,
            );
            
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
            
            this.gpu.updateUniforms({
                baseNumPoints: this.imagePoints.length,
                distortNumPoints: this.imagePoints.length,
                imageWidth: this.imageData.width,
                imageHeight: this.imageData.height,
                faceMinY: this.imageBBox.minY,
                faceMinX: this.imageBBox.minX,
                faceWidth: this.imageBBox.maxX - this.imageBBox.minX,
                faceHeight: this.imageBBox.maxY - this.imageBBox.minY
            });

            console.log('GPU buffers initialized successfully for ImageTPS');
        } catch (error) {
            console.error('Failed to initialize GPU for ImageTPS:', error);
        }
    }

    getEmotionTransform(emotionLevels: EmotionLevels) {
        let emotionPoints = [];

        const emotion = this.emotionModel.calculateCompositeEmotion(emotionLevels);
        for (const [key, value] of this.imageLandmarks) {
            const index = parseInt(key);
            emotionPoints.push([emotion[index*3] + meanFace[index*3], emotion[index*3+1] - meanFace[index*3+1], emotion[index*3+2] + meanFace[index*3+2]]);
        }
        // const emotionBBox = getBBox(emotionPoints);
        // const scaleY = (this.modelBBox.maxY - this.modelBBox.minY) / (emotionBBox.maxY - emotionBBox.minY);
        // const scaleX = (this.modelBBox.maxX - this.modelBBox.minX) / (emotionBBox.maxX - emotionBBox.minX);
        // const scaleZ = (this.modelBBox.maxZ - this.modelBBox.minZ) / (emotionBBox.maxZ - emotionBBox.minZ);
        // const offsetX = this.modelBBox.minX - emotionBBox.minX * scaleX;
        // const offsetY = this.modelBBox.minY - emotionBBox.minY * scaleY;
        // const offsetZ = this.modelBBox.minZ - emotionBBox.minZ * scaleZ;

        // emotionPoints = emotionPoints.map(p => [p[0] * scaleX + offsetX, p[1] * scaleY + offsetY, p[2] * scaleZ + offsetZ, 0]);

        const emotionTPS = new TPS(this.modelPoints, emotionPoints);
        return this.precomputeTransformationMaps(emotionTPS);
    }

    precomputeTransformationMaps(tps: TPS): Map<string, number[]> {
        const map = new Map();
        for (let y = this.imageBBox.minY; y < this.imageBBox.maxY; y++) {
          for (let x = this.imageBBox.minX; x < this.imageBBox.maxX; x++) {
            const key = `${x},${y}`;
            const transform = this.baseTPS.forward(tps.forward(this.baseTPS.inverse([x, y, 0])));
            map.set(key, transform);
          }
        }
        return map;
    }

    transformXY(emotionLevels: EmotionLevels, x, y): [number, number] {      
        let xPrime = x * 100;
        let yPrime = y * 100;
        let weights = 100;

        for (const key in emotionLevels) {
            if (emotionLevels[key] == 0) continue;
            const transform = this.emotionTransforms[key].get(`${x},${y}`);
            xPrime += emotionLevels[key] * transform[0];
            yPrime += emotionLevels[key] * transform[1];
            weights += emotionLevels[key];
        }
        
        return [xPrime / weights, yPrime / weights];
    }

    // GPU-accelerated transformation method
    async transformGPU(emotionLevels: EmotionLevels): Promise<ImageData | null> {
        if (!this.gpu.initialized) {
            console.log('GPU not ready for ImageTPS, falling back to CPU');
            return null;
        }

        try {
            // Create emotion-based transformation TPS
            const emotionPoints = [];
            const emotion = this.emotionModel.calculateCompositeEmotion(emotionLevels);
            for (const [key, value] of this.imageLandmarks) {
                const index = parseInt(key);
                emotionPoints.push([emotion[index*3] + meanFace[index*3], emotion[index*3+1] - meanFace[index*3+1], emotion[index*3+2] + meanFace[index*3+2]]);
            }
            
            const emotionTPS = new TPS(this.modelPoints, emotionPoints);
            
            // Update GPU with emotion transformation coefficients
            this.gpu.updateCombinedCoeffs(this.gpu.model2distortCoeffsBuffer, emotionTPS.inverseParameters.Xc, emotionTPS.inverseParameters.Yc);
            
            const faceWidth = this.imageBBox.maxX - this.imageBBox.minX;
            const faceHeight = this.imageBBox.maxY - this.imageBBox.minY;
            
            this.gpu.updateUniforms({
                baseNumPoints: this.imagePoints.length,
                distortNumPoints: this.imagePoints.length,
                imageWidth: this.imageData.width,
                imageHeight: this.imageData.height,
                faceMinY: this.imageBBox.minY,
                faceMinX: this.imageBBox.minX,
                faceWidth: faceWidth,
                faceHeight: faceHeight
            });
            
            await this.gpu.execute(faceWidth, faceHeight);
            
            // Read the result
            const output = await this.gpu.readBuffer(this.gpu.faceDataBuffer, faceWidth * faceHeight * 4);
            const result = new ImageData(output, faceWidth, faceHeight);
            
            // Update face data with blur mask for next iteration
            this.gpu.updateFaceDataWithBlurMask(this.blurMask);
            
            return result;
        } catch (error) {
            console.error('Error executing GPU transformation for ImageTPS:', error);
            return null;
        }
    }

    // Method to draw using GPU with fallback to CPU
    async drawGPU(emotionLevels: EmotionLevels, originalImageData: ImageData): Promise<void> {
        const gpuResult = await this.transformGPU(emotionLevels);
        
        if (gpuResult) {
            // GPU succeeded, use the result
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.offscreenCtx.putImageData(gpuResult, 0, 0);
            this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);
            console.log("GPU rendering");
        } else {
            // GPU failed, fallback to CPU
            this.drawCPU(emotionLevels, originalImageData);
            console.log("CPU fallback");
        }
    }

    // CPU fallback method (existing logic)
    drawCPU(emotionLevels: EmotionLevels, originalImageData: ImageData): void {
        const adjustedEmotionLevels = {...emotionLevels};
        // Remove base emotion offset if needed
        for (var emotion in this.baseEmotionLevels) {
            adjustedEmotionLevels[emotion] -= this.baseEmotionLevels[emotion];
        }
        
        const newImageData = new Uint8ClampedArray(this.canvas.width * this.canvas.height * 4).fill(0);
        const imageWidth = originalImageData.width;
        
        for (var y = 0; y < this.canvas.height; y++) {
            for (var x = 0; x < this.canvas.width; x++) {
                if (this.mask[y * this.canvas.width + x] == 0) continue;
                const transformed = this.transformXY(adjustedEmotionLevels, x + this.imageBBox.minX, y + this.imageBBox.minY);
                const index = (y * this.canvas.width + x) * 4;
                const oldIndex = (Math.round(transformed[1]) * imageWidth + Math.round(transformed[0])) * 4;
                if (oldIndex >= 0 && oldIndex < originalImageData.data.length - 3) {
                    newImageData[index] = originalImageData.data[oldIndex];
                    newImageData[index + 1] = originalImageData.data[oldIndex + 1];
                    newImageData[index + 2] = originalImageData.data[oldIndex + 2];
                    newImageData[index + 3] = originalImageData.data[oldIndex + 3];
                }
            }
        }
        this.ctx.putImageData(new ImageData(newImageData, this.canvas.width, this.canvas.height), 0, 0);
    }

    // Cleanup method
    destroy(): void {
        if (this.gpu) {
            this.gpu.destroy();
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}
  
export default ImageTPS;
  

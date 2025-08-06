import TPS from '../tps/TPS';
import { silhouette } from "../data/features.json";
import GPU from '../tps/GPU';

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

class CameraTPS {
    imageLandmarks: Map<string, number[]>;
    cameraLandmarks: number[][];
    baseTransform: Map<string, number[]>;
    imagePoints: number[][];
    cameraPoints: number[][];
    imageBBox: BBox;
    cameraBBox: BBox;
    nilpotentTPS: TPS;
    baseTPS: TPS;
    activeTPS: TPS;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    hull: number[][];
    silhouetteHull: number[][];
    imageSilhouette: number[][];
    mask: Uint8ClampedArray;
    forwardMap: Map<string, number[]>;
    inverseMap: number[][];
    offscreenCanvas: OffscreenCanvas;
    offscreenCtx: OffscreenCanvasRenderingContext2D;
    processingScale: number;
    imageData: ImageData;
    landmarkSkip: number;
    blurMask: Uint8ClampedArray;
    gpu: GPU;

    constructor(imageLandmarks: Map<string, number[]>, cameraLandmarks: number[][], imageData: ImageData, processingScale: number = 2) {
        this.imageLandmarks = imageLandmarks;
        this.cameraLandmarks = cameraLandmarks;

        this.imagePoints = [];
        this.cameraPoints = [];

        this.imageData = imageData;
        this.landmarkSkip = 4;
        
        this.silhouetteHull = [];
        for (let i = 0; i < silhouette.path.length; i++) {
            this.silhouetteHull.push([cameraLandmarks[silhouette.path[i]][0], cameraLandmarks[silhouette.path[i]][1]]);
        }
        for (const [key, value] of imageLandmarks) {
            const index = parseInt(key);
            if (index < cameraLandmarks.length) {
                this.imagePoints.push(value.slice(0, 2));
                this.cameraPoints.push([cameraLandmarks[index][0], cameraLandmarks[index][1]]);
            } else {
                console.log("Image landmark index out of bounds:", index);
            }
        }

        this.gpu = new GPU();
        
        this.baseTPS = new TPS(this.cameraPoints, this.imagePoints);
        console.log(this.baseTPS);
        this.nilpotentTPS = new TPS(
            this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2)), 
            this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2))
        );
        this.activeTPS = this.nilpotentTPS;

        this.imageSilhouette = [];
        for (let i = 0; i < this.silhouetteHull.length; i++) {
            this.imageSilhouette.push(this.baseTPS.forward(this.silhouetteHull[i]));
        }
        this.imageBBox = getBBox(this.imageSilhouette);
        console.log(this.imageBBox);
        this.cameraBBox = getBBox(this.silhouetteHull);

        this.inverseMap = this.precomputeTransformationMap(this.baseTPS);

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.imageBBox.maxX - this.imageBBox.minX;
        this.canvas.height = this.imageBBox.maxY - this.imageBBox.minY;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = this.imageBBox.minY + 'px';
        this.canvas.style.left = this.imageBBox.minX + 'px';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.background = 'transparent';
        this.ctx = this.canvas.getContext('2d');

        this.offscreenCanvas = new OffscreenCanvas(this.canvas.width / processingScale, this.canvas.height / processingScale);
        this.processingScale = processingScale;
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
        let tmp = new Uint8ClampedArray([...this.mask]);
        this.blurMask = new Uint8ClampedArray(this.canvas.width * this.canvas.height);
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

        console.log(this.blurMask);

        // Now initialize GPU after all TPS objects and data are ready
        this.gpu.initialize().then(() => {
            console.log('GPU initialized successfully');
            this.gpu.createBuffers({
                baseNumPoints: this.cameraPoints.length, // Use cameraPoints.length to match the TPS coefficients
                distortNumPoints: this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).length,
                imageWidth: this.imageData.width,
                imageHeight: this.imageData.height,
                faceMinY: this.imageBBox.minY,
                faceMinX: this.imageBBox.minX,
                faceWidth: this.imageBBox.maxX - this.imageBBox.minX,
                faceHeight: this.imageBBox.maxY - this.imageBBox.minY
            });
            
            // Update all buffers
            this.gpu.updateBuffer(this.gpu.meshPointsBuffer, new Float32Array(this.cameraPoints.map((d) => d.slice(0,2)).flat()));
            this.gpu.updateBuffer(this.gpu.imagePointsBuffer, new Float32Array(this.imagePoints.map((d) => d.slice(0,2)).flat()));
            this.gpu.updateBuffer(this.gpu.distortPointsBuffer, new Float32Array(this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map((d) => d.slice(0,2)).flat()));
            this.gpu.updateBuffer(this.gpu.modelPointsBuffer, new Float32Array(this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map((d) => d.slice(0,2)).flat()));
            
            // Update combined base coefficients (forward and inverse)
            console.log(this.baseTPS.inverseParameters.Xc, this.baseTPS.inverseParameters.Yc, this.baseTPS.forwardParameters.Xc, this.baseTPS.forwardParameters.Yc);
            this.gpu.updateBaseCoeffs(
                this.baseTPS.inverseParameters.Xc,
                this.baseTPS.inverseParameters.Yc,
                this.baseTPS.forwardParameters.Xc,
                this.baseTPS.forwardParameters.Yc,
            );
            
            // Update active TPS coefficients
            this.gpu.updateCombinedCoeffs(this.gpu.model2distortCoeffsBuffer, this.activeTPS.inverseParameters.Xc, this.activeTPS.inverseParameters.Yc);
            
            // Convert image data to uint32 array
            const imageDataUint32 = new Uint32Array(this.imageData.data.length / 4);
            for (let i = 0; i < this.imageData.data.length; i += 4) {
                imageDataUint32[i / 4] = (this.imageData.data[i + 3] << 24) | 
                                 (this.imageData.data[i + 2] << 16) | 
                                 (this.imageData.data[i + 1] << 8) | 
                                 this.imageData.data[i];
            }
            this.gpu.updateUintBuffer(this.gpu.imageDataBuffer, imageDataUint32);
            
            // Update face data with blur mask in alpha channel
            this.gpu.updateFaceDataWithBlurMask(this.blurMask);
            
            this.gpu.updateUniforms({
                baseNumPoints: this.cameraPoints.length,
                distortNumPoints: this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).length,
                imageWidth: this.imageData.width,
                imageHeight: this.imageData.height,
                faceMinY: this.imageBBox.minY,
                faceMinX: this.imageBBox.minX,
                faceWidth: this.imageBBox.maxX - this.imageBBox.minX,
                faceHeight: this.imageBBox.maxY - this.imageBBox.minY
            });

            console.log('GPU buffers initialized successfully');
        }).catch((error) => {
            console.error('Failed to initialize GPU:', error);
        });

        return this;
    }

    precomputeTransformationMap(tps: TPS): number[][] {
        const inverseMap = [];
        for (let y = this.imageBBox.minY; y < this.imageBBox.maxY; y++) {
          for (let x = this.imageBBox.minX; x < this.imageBBox.maxX; x++) {
            const transform = tps.inverse([x, y, 0]);
            inverseMap.push(transform);
            //inverseMap.set(`${x},${y},0`, transform);
            // forwardMap.set(`${transform[0]},${transform[1]},${transform[2]}`, [x, y, 0]);
          }
        }
        return inverseMap;
    }

    updateActiveTPS(newLandmarks: number[][]) {
        if (newLandmarks.length != this.cameraLandmarks.length) {
            return false;
        }
        this.activeTPS = new TPS(
            this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2)), 
            newLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2))
        );
        return true;
    }

    updateActiveTargets(newLandmarks: number[][]) {
        const params = this.activeTPS.updateInverseParameters(newLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2)));
        if (params && this.gpu.initialized) { // Check if GPU is initialized
            this.gpu.updateBuffer(this.gpu.distortPointsBuffer, new Float32Array(newLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map((d) => d.slice(0,2)).flat()));
            //console.log(params);
            this.gpu.updateCombinedCoeffs(this.gpu.model2distortCoeffsBuffer, params.Xc, params.Yc);
        }
        return true;
    }

    transformXY(x, y): [number, number] {      
        const inv = this.inverseMap[(y - this.imageBBox.minY) * (this.imageBBox.maxX - this.imageBBox.minX) + x - this.imageBBox.minX];
        return this.baseTPS.forward(this.activeTPS.inverse(inv));
    }

    draw() {
      const scaledWidth = Math.floor(this.canvas.width / this.processingScale);
      const scaledHeight = Math.floor(this.canvas.height / this.processingScale);
      const newImageData = new Uint8ClampedArray(scaledWidth * scaledHeight * 4).fill(0);
      
      let scaledY = 0;
      for (let y = 0; y < this.canvas.height; y += this.processingScale) {
        let scaledX = 0;
        for (let x = 0; x < this.canvas.width; x += this.processingScale) {
          // if (this.mask[y * this.canvas.width + x] === 0) {
          //   scaledX++;
          //   continue;
          // }

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
          
          // const dist = .75 * Math.hypot(tpsX - originalX, tpsY - originalY);
          // const [transformedX, transformedY] = [originalX + dist * (tpsX - originalX), originalY + dist * (tpsY - originalY)];
          
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

    drawGPU() {
        if (!this.gpu.initialized) {
            console.log('GPU not ready, falling back to CPU');
            this.draw();
            return;
        }
        
        const faceWidth = this.imageBBox.maxX - this.imageBBox.minX;
        const faceHeight = this.imageBBox.maxY - this.imageBBox.minY;
        
        // Use lowercase property names
        this.gpu.updateUniforms({
            baseNumPoints: this.cameraPoints.length,
            distortNumPoints: this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).length,
            imageWidth: this.imageData.width,
            imageHeight: this.imageData.height,
            faceMinY: this.imageBBox.minY,
            faceMinX: this.imageBBox.minX,
            faceWidth: faceWidth,  // This should now work
            faceHeight: faceHeight  // This should now work
        });
        
        this.gpu.execute(faceWidth, faceHeight).then(() => {
            // Read the result and convert back to ImageData
            this.gpu.readBuffer(this.gpu.faceDataBuffer, faceWidth * faceHeight * 4).then((output) => {
                // Convert Uint8Array to Uint8ClampedArray for ImageData
                const imageData = new ImageData(output, faceWidth, faceHeight);
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                // Put the face data at (0, 0) since the canvas is positioned via CSS transform
                this.offscreenCtx.putImageData(imageData, 0, 0);
                this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);
                
                this.gpu.updateFaceDataWithBlurMask(this.blurMask);
            }).catch((error) => {
                console.error('Error reading GPU buffer:', error);
                this.draw(); // Fallback to CPU
            });
        }).catch((error) => {
            console.error('Error executing GPU shader:', error);
            this.draw(); // Fallback to CPU
        });
    }

}
  
export default CameraTPS;
  

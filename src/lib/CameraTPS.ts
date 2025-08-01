import { NoEmotion, type EmotionLevels } from "../lib/EmotionModel";
import { silhouette } from "../data/features.json";
import SIMDTPS from './SIMDTPS';

type BBox = {
    minX: number;
    maxY: number;
    minY: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

class CameraTPS {
    private workers: Worker[] = [];
    private freeWorkers: Worker[] = [];
    private busyWorkers: Set<Worker> = new Set();
    private _canvas: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D;
    private _imageBBox: BBox;
    private _mask: Uint8ClampedArray;
    private isInitialized: boolean = false;
    private workerCount: number;
    private originalImageData: Uint8ClampedArray;
    private imageWidth: number;
    private imageHeight: number;
    private processingScale: number;
    
    // Frame staggering properties - simplified
    private workerTimings: number[] = [];
    private frameInterval: number = 0; // Will be set based on processing time
    private lastFrameTime: number = 0;
    private workerStartTimes: Map<Worker, number> = new Map();
    private frameQueue: number[][][] = []; // Fix: Add extra dimension
    private maxQueueSize: number = 3;
    private latestFrameData: number[][] | null = null;

    private simdSupported: boolean;
    private useSIMD: boolean;

    private sharedArrayBufferSupported: boolean;
    private sharedImageBuffer: SharedArrayBuffer | null = null;
    private sharedImageData: Uint8ClampedArray | null = null;
    private sharedMaskBuffer: SharedArrayBuffer | null = null;
    private sharedMaskData: Uint8ClampedArray | null = null;

    // Add scaled dimensions properties
    private scaledWidth: number;
    private scaledHeight: number;

    // Performance tracking properties
    private performanceTimings: {
        mediapipe: number[];
        regularization: number[];
        tpsCalculation: number[];
        imageTransformation: number[];
    } = {
        mediapipe: [],
        regularization: [],
        tpsCalculation: [],
        imageTransformation: []
    };

    constructor(imageLandmarks: Map<string, number[]>, cameraLandmarks: number[][], workerCount: number = 4) {
        this.workerCount = workerCount;
        this.simdSupported = this.checkSIMDSupport();
        this.useSIMD = this.simdSupported;
        this.sharedArrayBufferSupported = this.checkSharedArrayBufferSupport();
        
        // Create workers with SIMD support
        for (let i = 0; i < workerCount; i++) {
            const workerUrl = this.useSIMD ? 
                new URL('./CameraTPSWorkerSIMD.ts', import.meta.url) : 
                new URL('./CameraTPSWorker.ts', import.meta.url);
            
            const worker = new Worker(workerUrl, { type: 'module' });
            
            // Update worker message handler
            worker.onmessage = (e) => {
                const { type, data } = e.data;
                
                switch (type) {
                    case 'initialized':
                        this.freeWorkers.push(worker);
                        if (this.freeWorkers.length === this.workerCount) {
                            this.isInitialized = true;
                        }
                        break;
                        
                    case 'frameProcessed':
                        // Calculate processing time
                        const startTime = this.workerStartTimes.get(worker);
                        if (startTime) {
                            const processingTime = performance.now() - startTime;
                            this.workerTimings.push(processingTime);
                            
                            // Record the actual TPS calculation time (worker processing time)
                            this.performanceTimings.tpsCalculation.push(processingTime);
                            
                            // Keep only last 30 timings for rolling average
                            if (this.workerTimings.length > 10) {
                                this.workerTimings.shift();
                            }
                            if (this.performanceTimings.tpsCalculation.length > 30) {
                                this.performanceTimings.tpsCalculation.shift();
                            }
                            
                            // Adjust frame interval based on average processing time
                            this.adjustFrameInterval();
                        }
                        
                        this.busyWorkers.delete(worker);
                        this.freeWorkers.push(worker);
                        this.workerStartTimes.delete(worker);
                        
                        // Update canvas based on SharedArrayBuffer support
                        if (this.sharedArrayBufferSupported && data && data.newImageData) {
                            this.updateCanvasFromSharedBuffer();
                        } else if (data && data.newImageData) {
                            this.writeImageDataToCanvas(data.newImageData);
                        }
                        break;
                        
                    case 'timing':
                        if (data && data.imageTransformation) {
                            this.recordTiming('imageTransformation', data.imageTransformation);
                        }
                        break;
                }
            };
            
            this.workers.push(worker);
        }
        
        this.initializeWorkers(imageLandmarks, cameraLandmarks);
    }

    private async initializeWorkers(imageLandmarks: Map<string, number[]>, cameraLandmarks: number[][]) {
        // Calculate static data
        const imagePoints = [];
        const cameraPoints = [];
        
        const silhouetteHull = [];
        for (let i = 0; i < silhouette.path.length; i++) {
            silhouetteHull.push([cameraLandmarks[silhouette.path[i]][0], cameraLandmarks[silhouette.path[i]][1], cameraLandmarks[silhouette.path[i]][2]]);
        }

        for (const [key, value] of imageLandmarks) {
            const index = parseInt(key);
            if (index < cameraLandmarks.length) {
                imagePoints.push([...value]);
                cameraPoints.push([cameraLandmarks[index][0], cameraLandmarks[index][1], cameraLandmarks[index][2]]);
            }
        }

        const { TPS } = await import('transformation-models');
        const baseTPS = new TPS(cameraPoints, imagePoints);

        const imageSilhouette = [];
        for (let i = 0; i < silhouetteHull.length; i++) {
            imageSilhouette.push(baseTPS.forward(silhouetteHull[i]));
        }
        this._imageBBox = this.getBBox(imageSilhouette);

        const hull = this.calculateConvexHull(imageSilhouette);
        this._mask = new Uint8ClampedArray((this._imageBBox.maxX - this._imageBBox.minX) * (this._imageBBox.maxY - this._imageBBox.minY));
        for (let y = 0; y < (this._imageBBox.maxY - this._imageBBox.minY); y++) {
            for (let x = 0; x < (this._imageBBox.maxX - this._imageBBox.minX); x++) {
                this._mask[y * (this._imageBBox.maxX - this._imageBBox.minX) + x] = this.isPointInConvexHull([x + this._imageBBox.minX, y + this._imageBBox.minY], hull) ? 255 : 0;
            }
        }

        // Setup canvas
        this.setupCanvas();

        // Calculate scaled dimensions and mask
        this.scaledWidth = Math.floor((this._imageBBox.maxX - this._imageBBox.minX) * this.processingScale);
        this.scaledHeight = Math.floor((this._imageBBox.maxY - this._imageBBox.minY) * this.processingScale);
        
        const scaledMask = new Uint8ClampedArray(this.scaledWidth * this.scaledHeight);
        for (let y = 0; y < this.scaledHeight; y++) {
            for (let x = 0; x < this.scaledWidth; x++) {
                const originalX = Math.floor(x / this.processingScale);
                const originalY = Math.floor(y / this.processingScale);
                scaledMask[y * this.scaledWidth + x] = this._mask[originalY * (this._imageBBox.maxX - this._imageBBox.minX) + originalX];
            }
        }

        // Create shared buffers only if supported
        if (this.sharedArrayBufferSupported) {
            this.sharedImageBuffer = new SharedArrayBuffer(this.scaledWidth * this.scaledHeight * 4);
            this.sharedImageData = new Uint8ClampedArray(this.sharedImageBuffer);
            
            this.sharedMaskBuffer = new SharedArrayBuffer(this.scaledWidth * this.scaledHeight);
            this.sharedMaskData = new Uint8ClampedArray(this.sharedMaskBuffer);
            
            // Copy scaled mask data to shared buffer
            this.sharedMaskData.set(scaledMask);
        }

        // Initialize all workers with static data
        for (const worker of this.workers) {
            worker.postMessage({
                type: 'init',
                data: { 
                    imageLandmarks, 
                    cameraLandmarks, 
                    cameraPoints,
                    imagePoints,
                    originalImageData: this.originalImageData,
                    imageWidth: this.imageWidth,
                    imageHeight: this.imageHeight,
                    processingScale: this.processingScale,
                    scaledWidth: this.scaledWidth,
                    scaledHeight: this.scaledHeight,
                    scaledMask,
                    imageBBox: this._imageBBox,
                    sharedImageBuffer: this.sharedImageBuffer,
                    sharedMaskBuffer: this.sharedMaskBuffer,
                    sharedArrayBufferSupported: this.sharedArrayBufferSupported
                }
            });
        }
    }

    private setupCanvas() {
        this._canvas = document.createElement('canvas');
        // Canvas should be at original resolution, not scaled
        this._canvas.width = this._imageBBox.maxX - this._imageBBox.minX;
        this._canvas.height = this._imageBBox.maxY - this._imageBBox.minY;
        this._canvas.style.position = 'absolute';
        // Positioning should be at original scale, not scaled
        this._canvas.style.top = this._imageBBox.minY + 'px';
        this._canvas.style.left = this._imageBBox.minX + 'px';
        this._canvas.style.pointerEvents = 'none';
        this._canvas.style.background = 'transparent';
        this._ctx = this._canvas.getContext('2d')!;

        this._ctx.fillStyle = 'transparent';
        this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
    }

    private writeImageDataToCanvas(newImageData: Uint8ClampedArray) {
        const scaledWidth = Math.floor((this._imageBBox.maxX - this._imageBBox.minX) * this.processingScale);
        const scaledHeight = Math.floor((this._imageBBox.maxY - this._imageBBox.minY) * this.processingScale);
        
        // Check for valid dimensions
        if (scaledWidth <= 0 || scaledHeight <= 0) {
            return;
        }
        
        // Create a temporary canvas to scale the image data back to original size
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = scaledWidth;
        tempCanvas.height = scaledHeight;
        const tempCtx = tempCanvas.getContext('2d')!;
        
        // Put the scaled image data on temp canvas
        const imageData = new ImageData(newImageData, scaledWidth, scaledHeight);
        tempCtx.putImageData(imageData, 0, 0);
        
        // Draw the scaled image back to the original size canvas
        this._ctx.drawImage(tempCanvas, 0, 0, this._canvas.width, this._canvas.height);
    }

    processFrame(landmarks: number[][]): boolean {
        if (!this.isInitialized || this.freeWorkers.length === 0) {
            return false;
        }

        const now = performance.now();
        
        // Always store the most recent frame data
        this.latestFrameData = landmarks;
        
        // Check if enough time has passed since last processing
        if (this.frameInterval > 0 && now - this.lastFrameTime < this.frameInterval) {
            return false; // Not enough time has passed
        }

        // Process the most recent frame immediately
        const worker = this.freeWorkers.pop()!;
        this.busyWorkers.add(worker);
        this.workerStartTimes.set(worker, now);

        worker.postMessage({
            type: 'processFrame',
            data: { landmarks: this.latestFrameData }
        });

        this.lastFrameTime = now;
        
        return true;
    }

    setImageData(imageData: Uint8ClampedArray, width: number, height: number, processingScale: number = 0.5) {
        this.originalImageData = imageData;
        this.imageWidth = width;
        this.imageHeight = height;
        this.processingScale = processingScale;
    }

    // Helper methods
    private getBBox(points: number[][]): BBox {
  return {
    minX: Math.floor(Math.min(...points.map(p => p[0]))),
    maxX: Math.ceil(Math.max(...points.map(p => p[0]))),
    minY: Math.floor(Math.min(...points.map(p => p[1]))),
    maxY: Math.ceil(Math.max(...points.map(p => p[1]))),
    minZ: Math.floor(Math.min(...points.map(p => p[2]))),
    maxZ: Math.ceil(Math.max(...points.map(p => p[2]))),
        };
}

    private crossProduct(p1: number[], p2: number[], p3: number[]): number {
  return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
    }

    private distance(p1: number[], p2: number[]): number {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    }

    private calculateConvexHull(points: number[][]): number[][] {
  if (points.length < 3) return points;
  
  let lowest = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] < points[lowest][1] || 
        (points[i][1] === points[lowest][1] && points[i][0] < points[lowest][0])) {
      lowest = i;
    }
  }
  
  const start = points[lowest];
  const sortedPoints = points
    .filter((_, i) => i !== lowest)
    .sort((a, b) => {
      const angleA = Math.atan2(a[1] - start[1], a[0] - start[0]);
      const angleB = Math.atan2(b[1] - start[1], b[0] - start[0]);
      if (angleA !== angleB) return angleA - angleB;
                return this.distance(start, a) - this.distance(start, b);
    });
  
  const hull: number[][] = [start];
  for (const point of sortedPoints) {
            while (hull.length > 1 && this.crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
    }
    hull.push(point);
  }
  
  return hull;
    }

    private isPointInConvexHull(point: number[], hull: number[][]): boolean {
  if (hull.length < 3) return false;
  
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
            const cross = this.crossProduct(p1, p2, point);
    
    if (cross < 0) return false;
  }
  
  return true;
    }

    // Update the worker message handler to track timing
    private adjustFrameInterval() {
        if (this.workerTimings.length < 3) return;
        
        const avgProcessingTime = this.workerTimings.reduce((a, b) => a + b, 0) / this.workerTimings.length;
        
        // Frame interval = average processing time / number of workers
        this.frameInterval = avgProcessingTime / this.workerCount;
        
        // Clamp to reasonable bounds (50ms - 5000ms)
        this.frameInterval = Math.max(50, Math.min(5000, this.frameInterval));
    }

    // Method to set target frame rate
    // setTargetFrameRate(fps: number) {
    //     this.targetFrameRate = fps;
    //     this.frameInterval = 1000 / fps;
    // }

    // Method to get current performance stats
    getPerformanceStats() {
        if (this.workerTimings.length === 0) return null;
        
        const avgTime = this.workerTimings.reduce((a, b) => a + b, 0) / this.workerTimings.length;
        const maxTime = Math.max(...this.workerTimings);
        const minTime = Math.min(...this.workerTimings);
        const currentFPS = this.frameInterval > 0 ? 1000 / this.frameInterval : 0;
        
        return {
            avgProcessingTime: avgTime,
            maxProcessingTime: maxTime,
            minProcessingTime: minTime,
            currentFPS: currentFPS,
            workerCount: this.workerCount,
            freeWorkers: this.freeWorkers.length,
            busyWorkers: this.busyWorkers.size,
            queuedFrames: this.frameQueue.length
        };
    }

    // Add method to get detailed performance stats
    getDetailedPerformanceStats() {
        const calculateAverage = (timings: number[]) => {
            if (timings.length === 0) return 0;
            return timings.reduce((a, b) => a + b, 0) / timings.length;
        };

        return {
            mediapipe: {
                avg: calculateAverage(this.performanceTimings.mediapipe),
                count: this.performanceTimings.mediapipe.length
            },
            regularization: {
                avg: calculateAverage(this.performanceTimings.regularization),
                count: this.performanceTimings.regularization.length
            },
            tpsCalculation: {
                avg: calculateAverage(this.performanceTimings.tpsCalculation),
                count: this.performanceTimings.tpsCalculation.length
            },
            imageTransformation: {
                avg: calculateAverage(this.performanceTimings.imageTransformation),
                count: this.performanceTimings.imageTransformation.length
            }
        };
    }

    // Method to record external timing data
    recordTiming(component: 'mediapipe' | 'regularization' | 'imageTransformation', duration: number) {
        this.performanceTimings[component].push(duration);
        
        // Keep only last 30 timings for rolling average
        if (this.performanceTimings[component].length > 30) {
            this.performanceTimings[component].shift();
        }
    }

    // Getters for compatibility
    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }

    get ctx(): CanvasRenderingContext2D {
        return this._ctx;
    }

    get imageBBox(): BBox {
        return this._imageBBox;
    }

    get mask(): Uint8ClampedArray {
        return this._mask;
    }

    get initialized(): boolean {
        return this.isInitialized;
    }

    destroy() {
        for (const worker of this.workers) {
            worker.terminate();
        }
        if (this._canvas) {
            this._canvas.remove();
        }
    }

    private checkSIMDSupport(): boolean {
        return typeof WebAssembly !== 'undefined' && 
               typeof (WebAssembly as any).SIMD !== 'undefined' &&
               crossOriginIsolated;
    }

    private checkSharedArrayBufferSupport(): boolean {
        return typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated;
    }

    // Add method to get SIMD performance info
    getSIMDInfo(): { supported: boolean; enabled: boolean } {
        return {
            supported: this.simdSupported,
            enabled: this.useSIMD
        };
    }

    // Add method to check SharedArrayBuffer support
    getSharedArrayBufferInfo(): { supported: boolean; enabled: boolean } {
        return {
            supported: this.sharedArrayBufferSupported,
            enabled: this.sharedArrayBufferSupported
        };
    }

    // Add method to check WebGPU support
    getWebGPUInfo(): { supported: boolean; enabled: boolean } {
        return {
            supported: typeof navigator.gpu !== 'undefined',
            enabled: this.useSIMD // Since we're always using WebGPU workers now
        };
    }

    private updateCanvasFromSharedBuffer(): void {
        if (!this.sharedImageData) return;
        
        // Create ImageData directly from shared buffer
        const imageData = new ImageData(this.sharedImageData, this.scaledWidth, this.scaledHeight);
        
        // Create a temporary canvas to scale the image data back to original size
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.scaledWidth;
        tempCanvas.height = this.scaledHeight;
        const tempCtx = tempCanvas.getContext('2d')!;
        
        // Put the scaled image data on temp canvas
        tempCtx.putImageData(imageData, 0, 0);
        
        // Draw the scaled image back to the original size canvas
        this._ctx.drawImage(tempCanvas, 0, 0, this._canvas.width, this._canvas.height);
    }
}
  
export default CameraTPS;
  

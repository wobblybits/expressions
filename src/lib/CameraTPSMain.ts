import { silhouette } from "../data/features.json";
import { TPSWasm } from './tps_wrapper.js';

type BBox = {
    minX: number;
    maxY: number;
    minY: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

class CameraTPSMain {
    private _canvas: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D;
    private _imageBBox: BBox;
    private _mask: Uint8ClampedArray;
    private isInitialized: boolean = false;
    private originalImageData: Uint8ClampedArray;
    private imageWidth: number;
    private imageHeight: number;
    private processingScale: number;
    private scaledWidth: number;
    private scaledHeight: number;
    private cameraPoints: number[][];
    private imagePoints: number[][];
    private baseTPS: TPSWasm | null = null;

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

    constructor(imageLandmarks: Map<string, number[]>, cameraLandmarks: number[][]) {
        this.cameraPoints = []; //cameraLandmarks;
        this.imagePoints = []; //Array.from(imageLandmarks.values());
        
        for (const [key, value] of imageLandmarks) {
            this.imagePoints.push(value.slice(0, 2));
            const index = parseInt(key);
            this.cameraPoints.push(cameraLandmarks[index].slice(0, 2));
        }

        // Initialize canvas
        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d')!;
        
        // Initialize base TPS
        this.baseTPS = new TPSWasm(this.cameraPoints, this.imagePoints);
    }

    async setImageData(imageData: Uint8ClampedArray, width: number, height: number, processingScale: number = 0.5) {
        this.originalImageData = imageData;
        this.imageWidth = width;
        this.imageHeight = height;
        this.processingScale = processingScale;
        this.scaledWidth = Math.floor(width * processingScale);
        this.scaledHeight = Math.floor(height * processingScale);
          
        // Calculate bounding box
        this._imageBBox = this.getBBox(this.imagePoints);
        
        // Create mask
        this._mask = this.createMask();
        
        // Set canvas size
        this._canvas.width = this.scaledWidth;
        this._canvas.height = this.scaledHeight;

        await this.baseTPS.initialize();
        console.log(this.baseTPS.forward([0, 0]));
        this.isInitialized = true;
        console.log('Image data set, TPS ready');
    }

    async processFrame(landmarks: number[][]): Promise<boolean> {
        if (!this.isInitialized || !this.baseTPS) {
            console.warn('TPS not initialized');
            return false;
        }

        const startTime = performance.now();

        try {
            // Create TPS for this frame
            const activeTPS = new TPSWasm(this.cameraPoints, landmarks);
            await activeTPS.initialize(); // Wait for initialization

            const newImageData = new Uint8ClampedArray(this.scaledWidth * this.scaledHeight * 4).fill(0);
            
            // Process each pixel
            for (let y = 0; y < this.scaledHeight; y++) {
                for (let x = 0; x < this.scaledWidth; x++) {
                    if (this.mask[y * this.scaledWidth + x] === 0) continue;
                    
                    const originalX = x / this.processingScale + this._imageBBox.minX;
                    const originalY = y / this.processingScale + this._imageBBox.minY;
                    
                    const transformed = this.baseTPS!.forward(activeTPS.inverse(this.baseTPS!.inverse([originalX, originalY])));
                    const index = (y * this.scaledWidth + x) * 4;
                    const oldIndex = (Math.round(transformed[1]) * this.imageWidth + Math.round(transformed[0])) * 4;
                    
                    if (Math.round(transformed[0]) >= 0 && Math.round(transformed[0]) < this.imageWidth && 
                        Math.round(transformed[1]) >= 0 && Math.round(transformed[1]) < this.imageHeight) {
                        newImageData[index] = this.originalImageData[oldIndex];
                        newImageData[index + 1] = this.originalImageData[oldIndex + 1];
                        newImageData[index + 2] = this.originalImageData[oldIndex + 2];
                        newImageData[index + 3] = this.originalImageData[oldIndex + 3];
                    }
                }
            }
            
            // Update canvas
            const imageData = this._ctx.createImageData(this.scaledWidth, this.scaledHeight);
            imageData.data.set(newImageData);
            this._ctx.putImageData(imageData, 0, 0);
            
            // Record timing
            const processingTime = performance.now() - startTime;
            this.performanceTimings.tpsCalculation.push(processingTime);
            this.performanceTimings.imageTransformation.push(processingTime);
            
            // Clean up
            activeTPS.destroy();
            return true;
        } catch (error) {
            console.error('Error processing frame:', error);
            return false;
        }
    }

    private getBBox(points: number[][]): BBox {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        for (const point of points) {
            minX = Math.min(minX, point[0]);
            maxX = Math.max(maxX, point[0]);
            minY = Math.min(minY, point[1]);
            maxY = Math.max(maxY, point[1]);
            minZ = Math.min(minZ, point[2] || 0);
            maxZ = Math.max(maxZ, point[2] || 0);
        }
        
        return { minX, maxX, minY, maxY, minZ, maxZ };
    }

    private createMask(): Uint8ClampedArray {
        const mask = new Uint8ClampedArray(this.scaledWidth * this.scaledHeight);
        
        // Create a simple mask based on the silhouette
        for (let y = 0; y < this.scaledHeight; y++) {
            for (let x = 0; x < this.scaledWidth; x++) {
                const originalX = x / this.processingScale + this._imageBBox.minX;
                const originalY = y / this.processingScale + this._imageBBox.minY;
                
                // Check if point is within the silhouette
                if (this.isPointInSilhouette([originalX, originalY])) {
                    mask[y * this.scaledWidth + x] = 255;
                }
            }
        }
        console.log(mask);
        return mask;
    }

    private isPointInSilhouette(point: number[]): boolean {
        // Simple check - you can implement more sophisticated silhouette checking here
        return true; // For now, process all points
    }

    getPerformanceStats() {
        const calculateAverage = (timings: number[]) => 
            timings.length > 0 ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;
        
        return {
            tpsCalculation: calculateAverage(this.performanceTimings.tpsCalculation),
            imageTransformation: calculateAverage(this.performanceTimings.imageTransformation),
            totalFrames: this.performanceTimings.tpsCalculation.length
        };
    }

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
        if (this.baseTPS) {
            this.baseTPS.destroy();
            this.baseTPS = null;
        }
        this.isInitialized = false;
    }
}

export default CameraTPSMain; 
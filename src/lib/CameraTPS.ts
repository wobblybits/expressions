import { NoEmotion, type EmotionLevels } from "../lib/EmotionModel";
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

class CameraTPS {
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
    private scaledMask: Uint8ClampedArray;
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
        this.cameraPoints = cameraLandmarks;
        this.imagePoints = Array.from(imageLandmarks.values());
        
        // Initialize canvas
        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d')!;
        
        // Initialize base TPS
        this.initializeBaseTPS();
    }

    private async initializeBaseTPS() {
        try {
            console.log('Initializing base TPS...');
            this.baseTPS = new TPSWasm(this.cameraPoints, this.imagePoints);
            await this.baseTPS.initialize();
            console.log('Base TPS initialized successfully');
        } catch (error) {
            console.error('Failed to initialize base TPS:', error);
        }
    }

    setImageData(imageData: Uint8ClampedArray, width: number, height: number, processingScale: number = 0.5) {
        this.originalImageData = imageData;
        this.imageWidth = width;
        this.imageHeight = height;
        this.processingScale = processingScale;
        this.scaledWidth = Math.floor(width * processingScale);
        this.scaledHeight = Math.floor(height * processingScale);
        
        // Create scaled mask
        this.scaledMask = new Uint8ClampedArray(this.scaledWidth * this.scaledHeight);
        
        // Calculate bounding box
        this._imageBBox = this.getBBox(this.imagePoints);
        
        // Create mask
        this._mask = this.createMask();
        
        // Set canvas size
        this._canvas.width = this.scaledWidth;
        this._canvas.height = this.scaledHeight;
        
        this.isInitialized = true;
        console.log('Image data set, TPS ready');
    }

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

    private createMask(): Uint8ClampedArray {
        // Implementation for creating mask
        return new Uint8ClampedArray(this.scaledWidth * this.scaledHeight);
    }

    // ... rest of existing methods ...
}


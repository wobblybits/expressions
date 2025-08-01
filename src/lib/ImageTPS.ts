import { NoEmotion, type EmotionLevels } from "../lib/EmotionModel";
import { TPSWasm } from './tps_wrapper.js';
import EmotionModel from "../lib/EmotionModel";
import meanFace from "../data/mean.json";
import { silhouette } from "../data/features.json";

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
    nilpotentTPS: TPSWasm | null = null;
    baseTPS: TPSWasm | null = null;
    baseEmotionLevels: EmotionLevels;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    hull: number[][];
    silhouetteHull: number[][];
    imageSilhouette: number[][];
    mask: Uint8ClampedArray;

    constructor(imageLandmarks: Map<string, number[]>, emotionLevels: EmotionLevels, emotionModel: EmotionModel) {
        this.imageLandmarks = imageLandmarks;
        this.emotionModel = emotionModel;
        this.emotionTransforms = [];
        this.baseTransform = new Map();
        this.imagePoints = Array.from(imageLandmarks.values());
        this.modelPoints = this.getModelPoints(emotionLevels);
        this.imageBBox = getBBox(this.imagePoints);
        this.modelBBox = getBBox(this.modelPoints);
        
        // Initialize canvas
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d')!;
        
        // Initialize TPS instances
        this.initializeTPS();
        
        // Create mask
        this.mask = this.createMask();
        
        // Set canvas size
        this.canvas.width = this.imageBBox.maxX - this.imageBBox.minX;
        this.canvas.height = this.imageBBox.maxY - this.imageBBox.minY;
    }

    private async initializeTPS() {
        try {
            // Initialize base TPS
            this.baseTPS = new TPSWasm(this.modelPoints, this.imagePoints);
            await this.baseTPS.initialize();
            
            // Initialize nilpotent TPS
            this.nilpotentTPS = new TPSWasm(this.imagePoints, this.imagePoints);
            await this.nilpotentTPS.initialize();
            
            console.log('ImageTPS WASM initialized successfully');
        } catch (error) {
            console.error('Failed to initialize ImageTPS WASM:', error);
        }
    }

    private getModelPoints(emotionLevels: EmotionLevels): number[][] {
        const composite = this.emotionModel.calculateCompositeEmotion(emotionLevels);
        if (!composite) {
            // Fallback to mean face if no composite emotion
            const points: number[][] = [];
            for (let i = 0; i < meanFace.length; i += 3) {
                points.push([meanFace[i], meanFace[i + 1], meanFace[i + 2]]);
            }
            return points;
        }
        
        // Combine mean face with composite emotion
        const points: number[][] = [];
        for (let i = 0; i < meanFace.length; i += 3) {
            const x = meanFace[i] + composite[i];
            const y = meanFace[i + 1] - composite[i + 1]; // Note the subtraction for Y
            const z = meanFace[i + 2] + composite[i + 2];
            points.push([x, y, z]);
        }
        return points;
    }

    private createMask(): Uint8ClampedArray {
        const width = this.imageBBox.maxX - this.imageBBox.minX;
        const height = this.imageBBox.maxY - this.imageBBox.minY;
        return new Uint8ClampedArray(width * height);
    }

    precomputeTransformationMaps(tps: TPSWasm): Map<string, number[]> {
        const map = new Map();
        for (let y = this.imageBBox.minY; y < this.imageBBox.maxY; y++) {
          for (let x = this.imageBBox.minX; x < this.imageBBox.maxX; x++) {
            const key = `${x},${y}`;
            const transform = this.baseTPS!.forward(tps.forward(this.baseTPS!.inverse([x, y, 0])));
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
}
  
export default ImageTPS;
  

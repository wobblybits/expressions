import { NoEmotion, type EmotionLevels } from "../../emotions/lib/EmotionModel";
import EmotionModel from "../../emotions/lib/EmotionModel";
import TPS from "../../../tps/TPS";
import meanFace from "../../../data/mean.json";
import { silhouette } from "../../../data/features.json";

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

    constructor(imageLandmarks: Map<string, number[]>, emotionLevels: EmotionLevels, emotionModel: EmotionModel) {
        this.emotionModel = emotionModel;
        this.imageLandmarks = imageLandmarks;

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

        return this;
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
}
  
export default ImageTPS;
  

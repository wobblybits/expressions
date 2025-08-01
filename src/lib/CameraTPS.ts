import { NoEmotion, type EmotionLevels } from "../lib/EmotionModel";
import { TPS } from 'transformation-models';
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
    inverseMap: Map<string, number[]>;

    constructor(imageLandmarks: Map<string, number[]>, cameraLandmarks: number[][]) {
        this.imageLandmarks = imageLandmarks;
        this.cameraLandmarks = cameraLandmarks;

        this.imagePoints = [];
        this.cameraPoints = [];
        
        this.silhouetteHull = [];
        for (let i = 0; i < silhouette.path.length; i++) {
            this.silhouetteHull.push([cameraLandmarks[silhouette.path[i]][0], cameraLandmarks[silhouette.path[i]][1], cameraLandmarks[silhouette.path[i]][2]]);
        }

        for (const [key, value] of imageLandmarks) {
            const index = parseInt(key);
            if (index < cameraLandmarks.length) {
                this.imagePoints.push([...value]);
                this.cameraPoints.push([cameraLandmarks[index][0], cameraLandmarks[index][1], cameraLandmarks[index][2]]);
            } else {
                console.log("Image landmark index out of bounds:", index);
            }
        }

        this.baseTPS = new TPS(this.cameraPoints, this.imagePoints);
        this.nilpotentTPS = new TPS(this.imagePoints, this.imagePoints);
        this.activeTPS = this.nilpotentTPS;

        this.imageSilhouette = [];
        for (let i = 0; i < this.silhouetteHull.length; i++) {
            this.imageSilhouette.push(this.baseTPS.forward(this.silhouetteHull[i]));
        }
        this.imageBBox = getBBox(this.imageSilhouette);
        this.cameraBBox = getBBox(this.silhouetteHull);

        const {forwardMap, inverseMap} = this.precomputeTransformationMaps(this.nilpotentTPS);
        this.forwardMap = forwardMap;
        this.inverseMap = inverseMap;

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

    precomputeTransformationMaps(tps: TPS): {forwardMap: Map<string, number[]>, inverseMap: Map<string, number[]>} {
        const forwardMap = new Map();
        const inverseMap = new Map();
        for (let y = this.imageBBox.minY; y < this.imageBBox.maxY; y++) {
          for (let x = this.imageBBox.minX; x < this.imageBBox.maxX; x++) {
            const transform = tps.forward([x, y, 0]);
            inverseMap.set(`${x},${y},0`, transform);
            forwardMap.set(`${transform[0]},${transform[1]},${transform[2]}`, [x, y, 0]);
          }
        }
        return {forwardMap, inverseMap};
    }

    updateActiveTPS(newLandmarks: number[][]) {
        if (newLandmarks.length != this.cameraLandmarks.length) {
            return false;
        }
        this.activeTPS = new TPS(this.cameraLandmarks, newLandmarks);
        return true;
    }

    transformXY(x, y): [number, number] {      
        return this.baseTPS.forward(this.activeTPS.inverse(this.baseTPS.inverse([x, y, 0])));
        const pixToLandmark = this.inverseMap.get(`${x},${y},0`);
        const landmarkDeform = this.activeTPS.inverse(pixToLandmark);
        const deformToPix = this.baseTPS.forward(landmarkDeform);
        // console.log(pixToLandmark, landmarkDeform, deformToPix);
        return [deformToPix[0], deformToPix[1]];
    }
}
  
export default CameraTPS;
  

import { BaseTPS, type TPSTransformationPoints } from '../../../tps/ImageTPS';
import TPS from '../../../tps/TPS';

class CameraTPS extends BaseTPS {
    cameraLandmarks: number[][];
    cameraPoints: number[][];
    cameraBBox: any;
    landmarkSkip: number;
    inverseMap: number[][];

    constructor(imageLandmarks: Map<number, number[]>, cameraLandmarks: number[][], imageData: ImageData, processingScale: number = 2) {
        // Create silhouette points first
        const silhouettePoints = cameraLandmarks.map(landmark => [landmark[0], landmark[1]]);
        
        super(imageLandmarks, imageData, processingScale, silhouettePoints);
        
        // Store camera-specific data AFTER calling super
        this.cameraLandmarks = cameraLandmarks;
        this.landmarkSkip = 2;
        this.cameraPoints = [];
        
        // Build camera points from landmarks
        for (const [index, value] of imageLandmarks) {
            if (index < this.cameraLandmarks.length) {
                this.cameraPoints.push([this.cameraLandmarks[index][0], this.cameraLandmarks[index][1]]);
            } else {
                console.log("Image landmark index out of bounds:", index);
            }
        }

        this.cameraBBox = this.getBBox(this.silhouetteHull);
        this.inverseMap = this.precomputeTransformationMap(this.baseTPS);

        // Call setupTPS AFTER all properties are assigned
        this.setupTPS();

        // Initialize GPU asynchronously
        this.initializeGPU().then(() => {
            console.log('CameraTPS GPU initialized successfully');
        }).catch((error) => {
            console.error('Failed to initialize CameraTPS GPU:', error);
        });
    }

    setupTPS(): void {
        this.baseTPS = new TPS(this.cameraPoints, this.imagePoints);
        this.nilpotentTPS = new TPS(
            this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2)), 
            this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2))
        );
        this.activeTPS = this.nilpotentTPS;
    }

    getSilhouettePoints(): number[][] {
        // Use the constructor parameter directly since this.cameraLandmarks isn't set yet
        // We'll need to store this temporarily or pass it differently
        const points: number[][] = [];
        // For now, return empty array - the base class will handle this
        // We'll set up the real silhouette points after construction
        return points;
    }

    getTransformationPoints(): TPSTransformationPoints {
        return {
            base: this.cameraPoints,
            distort: this.cameraLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2))
        };
    }

    updateActiveTargets(newLandmarks: number[][]): boolean {
        const params = this.activeTPS.updateInverseParameters(newLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2)));
        if (params && this.gpu.initialized) {
            this.gpu.updateBuffer(this.gpu.distortPointsBuffer, new Float32Array(newLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map((d) => d.slice(0,2)).flat()));
            this.gpu.updateCombinedCoeffs(this.gpu.model2distortCoeffsBuffer, new Float32Array(params.Xc), new Float32Array(params.Yc));
        }
        return true;
    }

    transformXY(x: number, y: number): number[] {      
        const inv = this.inverseMap[(y - this.imageBBox.minY) * (this.imageBBox.maxX - this.imageBBox.minX) + x - this.imageBBox.minX];
        return this.baseTPS.forward(this.activeTPS.inverse(inv));
    }

    private precomputeTransformationMap(tps: TPS): number[][] {
        const inverseMap = [];
        for (let y = this.imageBBox.minY; y < this.imageBBox.maxY; y++) {
          for (let x = this.imageBBox.minX; x < this.imageBBox.maxX; x++) {
            const transform = tps.inverse([x, y, 0]);
            inverseMap.push(transform);
          }
        }
        return inverseMap;
    }

    private getBBox(points: number[][]) {
        return {
            minX: Math.floor(Math.min(...points.map(p => p[0]))),
            maxX: Math.ceil(Math.max(...points.map(p => p[0]))),
            minY: Math.floor(Math.min(...points.map(p => p[1]))),
            maxY: Math.ceil(Math.max(...points.map(p => p[1]))),
            minZ: Math.floor(Math.min(...points.map(p => p[2]))),
            maxZ: Math.ceil(Math.max(...points.map(p => p[2]))),
        };
    }
}
  
export default CameraTPS;
  

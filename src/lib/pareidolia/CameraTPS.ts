import { BaseTPS, type TPSTransformationPoints } from '../pareidolia/ImageTPS';
import TPS from '../tps/TPS';
import { getBBox } from './utils';

class CameraTPS extends BaseTPS {
    cameraLandmarks: number[][];
    cameraPoints: number[][];
    cameraBBox: any;
    landmarkSkip: number;
    inverseMap: number[][];
    allPoints: number[][];

    constructor(imageLandmarks: Map<number, number[]>, cameraLandmarks: number[][], imageData: ImageData, processingScale: number = 2) {
        console.log("imageData", imageData);
        super(imageLandmarks, cameraLandmarks, imageData, processingScale);
        
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

        this.allPoints = [];
        for (let i = 0; i < cameraLandmarks.length; i+=this.landmarkSkip) {
            this.allPoints.push([cameraLandmarks[i][0], cameraLandmarks[i][1], cameraLandmarks[i][2]]);
        }

        this.initialize();

        this.cameraBBox = getBBox(this.silhouetteHull);
        this.inverseMap = this.precomputeTransformationMap(this.baseTPS);
    }

    setupTPS(): void {
        this.baseTPS = new TPS(this.cameraPoints, this.imagePoints);
        this.nilpotentTPS = new TPS(this.allPoints, this.allPoints);
        this.activeTPS = this.nilpotentTPS;
    }

    getTransformationPoints(): TPSTransformationPoints {
        return {
            base: this.cameraPoints,
            distort: this.allPoints
        };
    }

    updateActiveTargets(newLandmarks: number[][]): boolean {
        try {
            const landmarks = newLandmarks.filter((_, i) => i % this.landmarkSkip === 0).map(d => d.slice(0,2));
            const params = this.activeTPS.updateInverseParameters(landmarks);
            // this.activeTPS = new TPS(this.allPoints, landmarks);
            // const params = this.activeTPS.inverseParameters;
            if (this.gpu.initialized) {
                this.gpu.updateBuffer(this.gpu.distortPointsBuffer, new Float32Array(params.sourcePoints.flat()));
                this.gpu.updateCombinedCoeffs(this.gpu.model2distortCoeffsBuffer, new Float32Array(params.Xc), new Float32Array(params.Yc));
            }
            return true;
        } catch (e) {
            // console.log("error", e);
            return false;
        }
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
}
  
export default CameraTPS;
  

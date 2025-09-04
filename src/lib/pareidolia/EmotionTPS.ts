import { NoEmotion, type EmotionLevels } from "../EmotionModel";
import EmotionModel from "../EmotionModel";
import { BaseTPS, type TPSTransformationPoints } from "./ImageTPS";
import TPS from "../tps/TPS";
import meanFace from "../../data/mean.json";
import { getBBox, calculateConvexHull, isPointInConvexHull, type BBox } from './utils';

class EmotionTPS extends BaseTPS {
    emotionModel: EmotionModel;
    emotionTransforms: Map<string, number[]>[];
    modelPoints: number[][];
    allPoints: number[][];
    modelBBox: any;
    emotionTPS: TPS;
    baseEmotionLevels: EmotionLevels;
    skipLandmarks: number;

    constructor(imageLandmarks: Map<number, number[]>, emotionLevels: EmotionLevels, emotionModel: EmotionModel, imageData: ImageData, blurMask: Uint8ClampedArray, imageBBox: BBox, processingScale: number = 1) {        
        const referenceLandmarks = [];
        for (let i = 0; i < meanFace.length; i+=3) {
            referenceLandmarks.push([meanFace[i], -meanFace[i+1], meanFace[i+2]]);
        }
        super(imageLandmarks, referenceLandmarks, imageData, blurMask, imageBBox, processingScale);
        
        this.emotionModel = emotionModel;
        this.skipLandmarks = 2;
        this.modelPoints = [];
        this.allPoints = [];

        this.baseEmotionLevels = {...NoEmotion, ...emotionLevels};
        const baseEmotion = emotionModel.calculateCompositeEmotion(this.baseEmotionLevels);
        
        // Build model points from emotion + mean face
        for (const [index] of imageLandmarks) {
            this.modelPoints.push([baseEmotion[index*3] + meanFace[index*3], baseEmotion[index*3+1] - meanFace[index*3+1], baseEmotion[index*3+2] + meanFace[index*3+2]]);
        }

        // Build all points for emotion transformations
        for (let i = 0; i < meanFace.length; i+=3*this.skipLandmarks) {
            this.allPoints.push([baseEmotion[i] + meanFace[i], baseEmotion[i+1] - meanFace[i+1], baseEmotion[i+2] + meanFace[i+2]]);
        }

        this.initialize();

        this.emotionTransforms = [];
        this.modelBBox = getBBox(this.silhouetteHull);

        // Precompute emotion transforms
        Object.keys(NoEmotion).forEach(key => {
            this.emotionTransforms[key] = this.getEmotionTransform({[key]: 100});
        });
    }

    setupTPS(): void {
        this.baseTPS = new TPS(this.modelPoints, this.imagePoints);
        this.emotionTPS = new TPS(this.allPoints, this.allPoints);
        this.nilpotentTPS = new TPS(this.allPoints, this.allPoints);
    }

    getTransformationPoints(): TPSTransformationPoints {
        return {
            base: this.modelPoints,
            distort: this.allPoints
        };
    }

    updateActiveTargets(emotionLevels: EmotionLevels): boolean {
        // For ImageTPS, this updates the emotion transformation
        const emotionPoints = [];
        const emotion = this.emotionModel.calculateCompositeEmotion(emotionLevels);
        let minY = Infinity;
        let maxY = -Infinity;
        let minX = Infinity;
        let maxX = -Infinity;
        for (var i=0; i < emotion.length; i+=3*this.skipLandmarks) {
            emotionPoints.push([emotion[i] + meanFace[i], -emotion[i+1] - meanFace[i+1]]);
            minY = Math.min(minY, -emotion[i+1] - meanFace[i+1]);
            maxY = Math.max(maxY, -emotion[i+1] - meanFace[i+1]);
            minX = Math.min(minX, emotion[i] + meanFace[i]);
            maxX = Math.max(maxX, emotion[i] + meanFace[i]);
        }

        let scaleY = (this.modelBBox.maxY - this.modelBBox.minY) / (maxY - minY);
        let scaleX = (this.modelBBox.maxX - this.modelBBox.minX) / (maxX - minX);
        emotionPoints.forEach(point => {
            point[0] = (point[0] - (maxX + minX) / 2) * scaleX + (this.modelBBox.maxX + this.modelBBox.minX) / 2;
            point[1] = (point[1] - (maxY + minY) / 2) * scaleY + (this.modelBBox.maxY + this.modelBBox.minY) / 2;
        });

        const params = this.emotionTPS.updateInverseParameters(emotionPoints);
        // console.log("params", params);
        // this.emotionTPS = new TPS(this.allPoints, emotionPoints);
        // const params = this.emotionTPS.forwardParameters;
        // console.log("emotionTPS", this.emotionTPS);
        if (this.gpu.initialized) {
            this.gpu.updateBuffer(this.gpu.distortPointsBuffer, new Float32Array(params.sourcePoints.flat()));
            this.gpu.updateCombinedCoeffs(this.gpu.model2distortCoeffsBuffer, new Float32Array(params.Xc), new Float32Array(params.Yc));
        }
        return true;
    }

    transformXYWithEmotion(emotionLevels: EmotionLevels, x: number, y: number): [number, number] {      
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

    // Implement the required abstract method from BaseTPS
    transformXY(x: number, y: number): number[] {
        // Return identity transform or implement as needed
        return [x, y, 0];
    }

    // GPU-accelerated transformation method
    async transformGPU(emotionLevels: EmotionLevels): Promise<ImageData | null> {
        if (!this.gpu.initialized) {
            console.log('GPU not ready for ImageTPS, falling back to CPU');
            return null;
        }

        try {
            this.updateActiveTargets(emotionLevels);
            
            const faceWidth = this.imageBBox.maxX - this.imageBBox.minX;
            const faceHeight = this.imageBBox.maxY - this.imageBBox.minY;
            
            this.updateGPUUniforms();
            
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
    async drawGPUWithEmotion(emotionLevels: EmotionLevels, originalImageData: ImageData): Promise<void> {
        if (!this.gpu.initialized) {
            console.log('GPU not ready, falling back to CPU');
            this.drawCPU(emotionLevels, originalImageData);
        }

        const gpuResult = await this.transformGPU(emotionLevels);
        
        if (gpuResult) {
            // GPU succeeded, use the result
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.offscreenCtx.putImageData(gpuResult, 0, 0);
            this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // GPU failed, fallback to CPU
            this.drawCPU(emotionLevels, originalImageData);
            console.log("CPU fallback");
        }
    }

    // Implement the required abstract method from BaseTPS
    async drawGPU(): Promise<void> {
        // This method is required by the base class but not used in this implementation
        // You can either leave it empty or implement a default behavior
        return Promise.resolve();
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
                const transformed = this.transformXYWithEmotion(adjustedEmotionLevels, x + this.imageBBox.minX, y + this.imageBBox.minY);
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
        this.offscreenCtx.putImageData(new ImageData(newImageData, this.canvas.width, this.canvas.height), 0, 0);
        this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);
        console.log("CPU rendering");
    }

    getEmotionTransform(emotionLevels: EmotionLevels) {
        let emotionPoints = [];

        const emotion = this.emotionModel.calculateCompositeEmotion(emotionLevels);
        for (const [index, value] of this.imageLandmarks) {
            emotionPoints.push([emotion[index*3] + meanFace[index*3], emotion[index*3+1] - meanFace[index*3+1], emotion[index*3+2] + meanFace[index*3+2]]);
        }

        const emotionTPS = new TPS(emotionPoints, this.modelPoints);
        return this.precomputeTransformationMaps(emotionTPS);
    }

    precomputeTransformationMaps(tps: TPS): Map<string, number[]> {
        const map = new Map();
        for (let y = this.imageBBox.minY; y < this.imageBBox.maxY; y++) {
          for (let x = this.imageBBox.minX; x < this.imageBBox.maxX; x++) {
            const key = `${x},${y}`;
            const transform = this.baseTPS.forward(tps.inverse(this.baseTPS.inverse([x, y, 0])));
            map.set(key, transform);
          }
        }
        return map;
    }
}
  
export default EmotionTPS;
import SIMDTPS from './SIMDTPS';
import { silhouette } from "../data/features.json";

// Static data shared by all workers
let staticData: {
    imageLandmarks: Map<string, number[]>;
    cameraLandmarks: number[][];
    baseTPS: SIMDTPS;
    originalImageData: Uint8ClampedArray;
    imageWidth: number;
    imageHeight: number;
    processingScale: number;
    scaledWidth: number;
    scaledHeight: number;
    scaledMask: Uint8ClampedArray;
    imageBBox: any;
    cameraPoints: number[][];
    imagePoints: number[][];
    sharedImageBuffer: SharedArrayBuffer;
    sharedImageData: Uint8ClampedArray;
    sharedMaskBuffer: SharedArrayBuffer;
    sharedMaskData: Uint8ClampedArray;
} | null = null;

self.onmessage = (e) => {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            staticData = data;
            staticData.sharedImageData = new Uint8ClampedArray(staticData.sharedImageBuffer);
            staticData.sharedMaskData = new Uint8ClampedArray(staticData.sharedMaskBuffer);
            staticData.baseTPS = new SIMDTPS(staticData.cameraPoints, staticData.imagePoints);
            self.postMessage({ type: 'initialized' });
            break;
            
        case 'processFrame':
            if (!staticData) {
                self.postMessage({ type: 'error', message: 'Not initialized' });
                return;
            }
            
            processFrameDirectSIMD(data.landmarks);
            self.postMessage({ type: 'frameProcessed' });
            break;
    }
};

function processFrameDirectSIMD(landmarks: number[][]): void {
    if (landmarks.length !== staticData!.cameraLandmarks.length) {
        return;
    }

    // Create TPS for this frame
    const activeTPS = new SIMDTPS(staticData!.cameraLandmarks, landmarks);
    
    // Clear the shared image buffer
    staticData!.sharedImageData.fill(0);
    
    // Process directly into shared buffer using SIMD optimizations
    for (let y = 0; y < staticData!.scaledHeight; y++) {
        for (let x = 0; x < staticData!.scaledWidth; x++) {
            if (staticData!.sharedMaskData[y * staticData!.scaledWidth + x] === 0) continue;
            
            const originalX = x / staticData!.processingScale + staticData!.imageBBox.minX;
            const originalY = y / staticData!.processingScale + staticData!.imageBBox.minY;
            
            const transformed = staticData!.baseTPS.forward([originalX, originalY, 0]);
            const index = (y * staticData!.scaledWidth + x) * 4;
            const oldIndex = (Math.round(transformed[1]) * staticData!.imageWidth + Math.round(transformed[0])) * 4;
            
            if (Math.round(transformed[0]) >= 0 && Math.round(transformed[0]) < staticData!.imageWidth && 
                Math.round(transformed[1]) >= 0 && Math.round(transformed[1]) < staticData!.imageHeight) {
                
                // Write directly to shared buffer
                staticData!.sharedImageData[index] = staticData!.originalImageData[oldIndex];
                staticData!.sharedImageData[index + 1] = staticData!.originalImageData[oldIndex + 1];
                staticData!.sharedImageData[index + 2] = staticData!.originalImageData[oldIndex + 2];
                staticData!.sharedImageData[index + 3] = staticData!.originalImageData[oldIndex + 3];
            }
        }
    }
} 
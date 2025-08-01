import { silhouette } from "../data/features.json";
import { TPSWasm } from './tps_wrapper.js';

// Static data shared by all workers
let staticData: {
    imageLandmarks: Map<string, number[]>;
    cameraLandmarks: number[][];
    baseTPS: TPSWasm;
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
    sharedImageBuffer: SharedArrayBuffer | null;
    sharedImageData: Uint8ClampedArray | null;
    sharedMaskBuffer: SharedArrayBuffer | null;
    sharedMaskData: Uint8ClampedArray | null;
    sharedArrayBufferSupported: boolean;
} | null = null;

self.onmessage = async (e) => {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            staticData = data;
            if (staticData.sharedArrayBufferSupported && staticData.sharedImageBuffer && staticData.sharedMaskBuffer) {
                staticData.sharedImageData = new Uint8ClampedArray(staticData.sharedImageBuffer);
                staticData.sharedMaskData = new Uint8ClampedArray(staticData.sharedMaskBuffer);
            }
            
            // Initialize WASM TPS
            staticData.baseTPS = new TPSWasm(staticData.cameraPoints, staticData.imagePoints);
            await staticData.baseTPS.initialize();
            
            self.postMessage({ type: 'initialized' });
            break;
            
        case 'processFrame':
            if (!staticData) {
                self.postMessage({ type: 'error', message: 'Not initialized' });
                return;
            }
            
            if (staticData.sharedArrayBufferSupported) {
                await processFrameDirect(data.landmarks);
                self.postMessage({ type: 'frameProcessed' });
            } else {
                const newImageData = await processFrame(data.landmarks);
                self.postMessage({
                    type: 'frameProcessed',
                    data: { newImageData }
                });
            }
            break;
    }
};

// Original processFrame function for fallback
async function processFrame(landmarks: number[][]): Promise<Uint8ClampedArray> {
    if (landmarks.length !== staticData!.cameraLandmarks.length) {
        return new Uint8ClampedArray(staticData!.scaledWidth * staticData!.scaledHeight * 4);
    }

    // Create TPS for this frame
    const activeTPS = new TPSWasm(staticData!.cameraLandmarks, landmarks);
    await activeTPS.initialize();
    
    const newImageData = new Uint8ClampedArray(staticData!.scaledWidth * staticData!.scaledHeight * 4).fill(0);
    
    for (let y = 0; y < staticData!.scaledHeight; y++) {
        for (let x = 0; x < staticData!.scaledWidth; x++) {
            if (staticData!.scaledMask[y * staticData!.scaledWidth + x] === 0) continue;
            
            const originalX = x / staticData!.processingScale + staticData!.imageBBox.minX;
            const originalY = y / staticData!.processingScale + staticData!.imageBBox.minY;
            
            const transformed = staticData!.baseTPS.forward(activeTPS.inverse(staticData!.baseTPS.inverse([originalX, originalY, 0])));
            const index = (y * staticData!.scaledWidth + x) * 4;
            const oldIndex = (Math.round(transformed[1]) * staticData!.imageWidth + Math.round(transformed[0])) * 4;
            
            if (Math.round(transformed[0]) >= 0 && Math.round(transformed[0]) < staticData!.imageWidth && 
                Math.round(transformed[1]) >= 0 && Math.round(transformed[1]) < staticData!.imageHeight) {
                newImageData[index] = staticData!.originalImageData[oldIndex];
                newImageData[index + 1] = staticData!.originalImageData[oldIndex + 1];
                newImageData[index + 2] = staticData!.originalImageData[oldIndex + 2];
                newImageData[index + 3] = staticData!.originalImageData[oldIndex + 3];
            }
        }
    }
    
    activeTPS.destroy();
    return newImageData;
}

// SharedArrayBuffer version
async function processFrameDirect(landmarks: number[][]): Promise<void> {
    if (landmarks.length !== staticData!.cameraLandmarks.length) {
        return;
    }

    // Create TPS for this frame
    const activeTPS = new TPSWasm(staticData!.cameraLandmarks, landmarks);
    await activeTPS.initialize();
    
    // Clear the shared image buffer
    staticData!.sharedImageData!.fill(0);
    
    // Process directly into shared buffer
    for (let y = 0; y < staticData!.scaledHeight; y++) {
        for (let x = 0; x < staticData!.scaledWidth; x++) {
            if (staticData!.sharedMaskData![y * staticData!.scaledWidth + x] === 0) continue;
            
            const originalX = x / staticData!.processingScale + staticData!.imageBBox.minX;
            const originalY = y / staticData!.processingScale + staticData!.imageBBox.minY;
            
            const transformed = staticData!.baseTPS.forward(activeTPS.inverse(staticData!.baseTPS.inverse([originalX, originalY, 0])));
            const index = (y * staticData!.scaledWidth + x) * 4;
            const oldIndex = (Math.round(transformed[1]) * staticData!.imageWidth + Math.round(transformed[0])) * 4;
            
            if (Math.round(transformed[0]) >= 0 && Math.round(transformed[0]) < staticData!.imageWidth && 
                Math.round(transformed[1]) >= 0 && Math.round(transformed[1]) < staticData!.imageHeight) {
                
                // Write directly to shared buffer
                staticData!.sharedImageData![index] = staticData!.originalImageData[oldIndex];
                staticData!.sharedImageData![index + 1] = staticData!.originalImageData[oldIndex + 1];
                staticData!.sharedImageData![index + 2] = staticData!.originalImageData[oldIndex + 2];
                staticData!.sharedImageData![index + 3] = staticData!.originalImageData[oldIndex + 3];
            }
        }
    }
    
    activeTPS.destroy();
} 
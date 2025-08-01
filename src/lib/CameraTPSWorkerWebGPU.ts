import { TPS } from 'transformation-models';
import WebGPUTPS from './WebGPUTPS';

// Add this at the top of the file
declare global {
    interface Navigator {
        gpu?: any;
    }
}

// Static data shared by all workers
let staticData: {
    imageLandmarks: Map<string, number[]>;
    cameraLandmarks: number[][];
    baseTPS: TPS;
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
    gpuTPS: WebGPUTPS | null;
} | null = null;

self.onmessage = async (e) => {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            staticData = data;
            
            // Initialize WebGPU if supported
            if (typeof (navigator as any).gpu !== 'undefined') {
                staticData.gpuTPS = new WebGPUTPS();
                const gpuSupported = await staticData.gpuTPS.initialize();
                if (!gpuSupported) {
                    staticData.gpuTPS = null;
                }
            }
            
            if (staticData.sharedArrayBufferSupported && staticData.sharedImageBuffer && staticData.sharedMaskBuffer) {
                staticData.sharedImageData = new Uint8ClampedArray(staticData.sharedImageBuffer);
                staticData.sharedMaskData = new Uint8ClampedArray(staticData.sharedMaskBuffer);
            }
            
            staticData.baseTPS = new TPS(staticData.cameraPoints, staticData.imagePoints);
            self.postMessage({ type: 'initialized' });
            break;
            
        case 'processFrame':
            if (!staticData) {
                self.postMessage({ type: 'error', message: 'Not initialized' });
                return;
            }
            
            const imageTransformationStart = performance.now();
            
            if (staticData.gpuTPS && staticData.gpuTPS.isSupported()) {
                await processFrameGPU(data.landmarks);
                self.postMessage({ type: 'frameProcessed' });
                
                // Record image transformation timing only when GPU processing occurs
                const imageTransformationTime = performance.now() - imageTransformationStart;
                self.postMessage({
                    type: 'timing',
                    data: { imageTransformation: imageTransformationTime }
                });
            } else if (staticData.sharedArrayBufferSupported) {
                processFrameDirect(data.landmarks);
                self.postMessage({ type: 'frameProcessed' });
                
                // Record image transformation timing only when processing occurs
                const imageTransformationTime = performance.now() - imageTransformationStart;
                self.postMessage({
                    type: 'timing',
                    data: { imageTransformation: imageTransformationTime }
                });
            } else {
                const newImageData = processFrame(data.landmarks);
                self.postMessage({
                    type: 'frameProcessed',
                    data: { newImageData }
                });
                
                // Record image transformation timing only when processing occurs
                const imageTransformationTime = performance.now() - imageTransformationStart;
                self.postMessage({
                    type: 'timing',
                    data: { imageTransformation: imageTransformationTime }
                });
            }
            break;
    }
};

async function processFrameGPU(landmarks: number[][]): Promise<void> {
    if (!staticData!.gpuTPS) return;

    const result = await staticData!.gpuTPS.processFrame(
        landmarks,
        staticData!.originalImageData,
        staticData!.scaledMask,
        staticData!.scaledWidth,
        staticData!.scaledHeight,
        staticData!.processingScale,
        staticData!.imageBBox
    );

    // Copy result to shared buffer if available
    if (staticData!.sharedImageData) {
        staticData!.sharedImageData.set(result);
    }
}

// Add these functions at the end of the file
function processFrameDirect(landmarks: number[][]): void {
    if (landmarks.length !== staticData!.cameraLandmarks.length) {
        return;
    }

    // Create TPS for this frame
    const activeTPS = new TPS(staticData!.cameraLandmarks, landmarks);
    
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
}

function processFrame(landmarks: number[][]): Uint8ClampedArray {
    if (landmarks.length !== staticData!.cameraLandmarks.length) {
        return new Uint8ClampedArray(staticData!.scaledWidth * staticData!.scaledHeight * 4);
    }

    // Create TPS for this frame
    const activeTPS = new TPS(staticData!.cameraLandmarks, landmarks);
    
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
    
    return newImageData;
} 
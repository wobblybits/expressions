import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

interface FaceLandmarks {
  x: number;
  y: number;
  z: number;
}

class FaceMeshCamera {
  private faceMesh: FaceMesh;
  private camera: Camera;
  private videoElement: HTMLVideoElement;
  private onLandmarksCallback?: (landmarks: number[][]) => void;

  constructor(onLandmarks?: (landmarks: number[][]) => void) {
    this.onLandmarksCallback = onLandmarks;
    
    // Create video element (not added to DOM)
    this.videoElement = document.createElement('video');
    
    // Initialize FaceMesh
    this.faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `../node_modules/@mediapipe/face_mesh/${file}`;
      }
    });

    this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
    });

    // Set up results handling
    this.faceMesh.onResults((results: Results) => {
      if (results.multiFaceLandmarks && this.onLandmarksCallback) {
        //const regularizedLandmarks = results.multiFaceLandmarks.map(faceLandmarks => 
        //   this.regularizeLandmarks(faceLandmarks)
        // );
        const regularizedLandmarks = this.regularizeLandmarks(results.multiFaceLandmarks[0]);
        this.onLandmarksCallback(regularizedLandmarks);
      }
    });

    // Set up camera
    this.camera = new Camera(this.videoElement, {
      onFrame: async () => {
        await this.faceMesh.send({ image: this.videoElement });
      },
      width: 640,
      height: 480,
      facingMode: "user",
    });
  }

  private regularizeLandmarks(landmarks: FaceLandmarks[], imageScale: number = 1): number[][] {
    // Calculate face center
    if (!landmarks) return [];

    const center = {
      x: landmarks.reduce((sum, l) => sum + l.x, 0) / landmarks.length,
      y: landmarks.reduce((sum, l) => sum + l.y, 0) / landmarks.length,
      z: landmarks.reduce((sum, l) => sum + l.z, 0) / landmarks.length
    };

    let transformed = landmarks.map(l => ({
      x: l.x,
      y: l.y,
      z: l.z
    }));

    // Translate to origin
    const translated = transformed.map(l => ({
      x: l.x - center.x,
      y: l.y - center.y,
      z: l.z - center.z
    }));

    transformed = translated;

    // Calculate rotation to align face
    // Use ear landmarks (left: 234, right: 454) to determine face orientation
    const leftEar = transformed[234-1];
    const rightEar = transformed[454-1];
    
    // Calculate face width vector
    const faceWidth = {
      x: rightEar.x - leftEar.x,
      y: rightEar.y - leftEar.y,
      z: rightEar.z - leftEar.z
    };
    
    // Calculate rotation angle around Y axis to align width with X axis
    const yawAngle = Math.atan2(faceWidth.z, faceWidth.x);
    
    // Apply Y rotation (around Y axis)
    const rotatedY = transformed.map(l => {
      const cosY = Math.cos(-yawAngle);
      const sinY = Math.sin(-yawAngle);
      return {
        x: l.x * cosY - l.z * sinY,
        y: l.y,
        z: l.x * sinY + l.z * cosY
      };
    });

    transformed = rotatedY;

    // // Use nose bridge and chin to calculate pitch rotation
    // const noseBridge = transformed[168-1]; // Nose bridge
    // const chin = transformed[152-1]; // Chin
    
    // const faceHeight = {
    //   x: chin.x - noseBridge.x,
    //   y: chin.y - noseBridge.y,
    //   z: chin.z - noseBridge.z
    // };
    
    // // Calculate rotation angle around X axis to align height with Y axis
    // const pitchAngle = Math.atan2(-faceHeight.z, faceHeight.y);
    
    // // Apply X rotation (around X axis)
    // const rotatedX = transformed.map(l => {
    //   const cosX = Math.cos(-pitchAngle);
    //   const sinX = Math.sin(-pitchAngle);
    //   return {
    //     x: l.x,
    //     y: l.y * cosX - l.z * sinX,
    //     z: l.y * sinX + l.z * cosX
    //   };
    // });

    // transformed = rotatedX;


    // // Calculate rotation angle around Y axis to align width with X axis
    // const rollAngle = Math.atan2(faceWidth.y, faceWidth.x);
    
    // // Apply Y rotation (around Y axis)
    // const rotatedZ = transformed.map(l => {
    //   const cosY = Math.cos(-rollAngle);
    //   const sinY = Math.sin(-rollAngle);
    //   return {
    //     x: l.x * cosY - l.z * sinY,
    //     y: l.y,
    //     z: l.x * sinY + l.z * cosY
    //   };
    // });

    // transformed = rotatedZ;

    // Find y range for scaling
    const yCoords = transformed.map(l => l.y);
    const yRange = Math.max(...yCoords) - Math.min(...yCoords);
    const scale = 20000 / yRange; // 

    // Scale all coordinates
    let result = transformed.map(l => [l.x * scale * imageScale, -l.y * scale * imageScale, l.z * scale * imageScale]);
    // result = result.map(l => [Math.round(l[0]), Math.round(l[1]), Math.round(l[2])]);
    // console.log(result);
    return result;
  }

  start(): Promise<void> {
    return this.camera.start();
  }

  stop(): void {
    this.camera.stop();
  }

  setOnLandmarksCallback(callback: (landmarks: number[][]) => void): void {
    this.onLandmarksCallback = callback;
  }
}

export default FaceMeshCamera;
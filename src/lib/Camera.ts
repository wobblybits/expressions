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

  private regularizeLandmarks(landmarks: FaceLandmarks[]): number[][] {
    // Calculate face center
    if (!landmarks) return [];

    const center = {
      x: landmarks.reduce((sum, l) => sum + l.x, 0) / landmarks.length,
      y: landmarks.reduce((sum, l) => sum + l.y, 0) / landmarks.length,
      z: landmarks.reduce((sum, l) => sum + l.z, 0) / landmarks.length
    };

    // Translate to origin
    const translated = landmarks.map(l => ({
      x: l.x - center.x,
      y: l.y - center.y,
      z: l.z - center.z
    }));

    // Calculate rotation to align face
    // Use ear landmarks (left: 234, right: 454) to determine face orientation
    const leftEar = translated[234];
    const rightEar = translated[454];
    
    // Calculate face width vector
    const faceWidth = {
      x: rightEar.x - leftEar.x,
      y: rightEar.y - leftEar.y,
      z: rightEar.z - leftEar.z
    };
    
    // Calculate rotation angle around Y axis to align width with X axis
    const yawAngle = Math.atan2(faceWidth.z, faceWidth.x);
    
    // Apply Y rotation (around Y axis)
    const rotatedY = translated.map(l => {
      const cosY = Math.cos(-yawAngle);
      const sinY = Math.sin(-yawAngle);
      return {
        x: l.x * cosY - l.z * sinY,
        y: l.y,
        z: l.x * sinY + l.z * cosY
      };
    });

    // Use nose bridge and chin to calculate pitch rotation
    const noseBridge = rotatedY[168]; // Nose bridge
    const chin = rotatedY[152]; // Chin
    
    const faceHeight = {
      x: chin.x - noseBridge.x,
      y: chin.y - noseBridge.y,
      z: chin.z - noseBridge.z
    };
    
    // Calculate rotation angle around X axis to align height with Y axis
    const pitchAngle = Math.atan2(-faceHeight.z, faceHeight.y);
    
    // Apply X rotation (around X axis)
    const rotatedX = rotatedY.map(l => {
      const cosX = Math.cos(-pitchAngle);
      const sinX = Math.sin(-pitchAngle);
      return {
        x: l.x,
        y: l.y * cosX - l.z * sinX,
        z: l.y * sinX + l.z * cosX
      };
    });

    // Find y range for scaling
    const yCoords = rotatedX.map(l => l.y);
    const yRange = Math.max(...yCoords) - Math.min(...yCoords);
    const scale = 2 / yRange; // Scale so y range is -1 to 1

    // Scale all coordinates
    return rotatedX.map(l => [l.x * scale, -l.y * scale, l.z * scale]);
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
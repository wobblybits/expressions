// import { FaceMesh } from '@mediapipe/face_mesh';
// import { Camera } from '@mediapipe/camera_utils';

interface FaceLandmarks {
  x: number;
  y: number;
  z: number;
}

class FaceMeshCamera {
  private faceMesh: any;
  private camera: any;
  private videoElement: HTMLVideoElement;
  private onLandmarksCallback?: (landmarks: number[][]) => void;
  private isInitialized = false;
  
  // Add smoothing state
  private smoothedLandmarks: number[][] | null = null;
  private smoothingFactor: number = 0.3; // Adjustable: 0 = no smoothing, 1 = full smoothing

  constructor(onLandmarks?: (landmarks: number[][]) => void, smoothingFactor: number = 0.3) {
    this.onLandmarksCallback = onLandmarks;
    this.smoothingFactor = Math.max(0, Math.min(1, smoothingFactor));
    
    this.videoElement = document.createElement('video');
    
    // Initialize MediaPipe components asynchronously
    this.initializeMediaPipe();
  }

  private async initializeMediaPipe() {
    try {
      const [{ FaceMesh }, { Camera }] = await Promise.all([
        import('@mediapipe/face_mesh'),
        import('@mediapipe/camera_utils')
      ]);

      // Initialize FaceMesh
      this.faceMesh = new FaceMesh({
        locateFile: (file: string) => {
          return `../node_modules/@mediapipe/face_mesh/${file}`;
        }
      });

      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
      });

      // Set up results handling - use 'any' type for results
      this.faceMesh.onResults((results: any) => {
        if (results.multiFaceLandmarks && this.onLandmarksCallback) {
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

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
    }
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
    
    // Apply temporal smoothing
    result = this.applyTemporalSmoothing(result);
    
    return result;
  }

  private applyTemporalSmoothing(currentLandmarks: number[][]): number[][] {
    if (!this.smoothedLandmarks) {
      // Initialize with current landmarks on first frame
      this.smoothedLandmarks = currentLandmarks.map(landmark => [...landmark]);
      return this.smoothedLandmarks;
    }

    // Apply exponential moving average
    const smoothed = currentLandmarks.map((landmark, i) => {
      const prev = this.smoothedLandmarks![i];
      return [
        prev[0] + this.smoothingFactor * (landmark[0] - prev[0]),
        prev[1] + this.smoothingFactor * (landmark[1] - prev[1]),
        prev[2] + this.smoothingFactor * (landmark[2] - prev[2])
      ];
    });

    this.smoothedLandmarks = smoothed;
    return smoothed;
  }

  // Add method to adjust smoothing factor at runtime
  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
  }

  // Add method to reset smoothing state (useful when face is lost/found)
  resetSmoothing(): void {
    this.smoothedLandmarks = null;
  }

  start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MediaPipe components are not initialized. Call initializeMediaPipe() first.');
    }
    return this.camera.start();
  }

  stop(): void {
    if (!this.isInitialized) {
      throw new Error('MediaPipe components are not initialized. Call initializeMediaPipe() first.');
    }
    this.camera.stop();
  }

  setOnLandmarksCallback(callback: (landmarks: number[][]) => void): void {
    this.onLandmarksCallback = callback;
  }
}

export default FaceMeshCamera;
// import { FaceMesh } from '@mediapipe/face_mesh';
// import { Camera } from '@mediapipe/camera_utils';

interface FaceLandmarks {
    x: number;
    y: number;
    z: number;
  }
  
  class FaceMeshMovie {
    private faceMesh: any;
    private camera: any;
    private videoElement: HTMLVideoElement;
    private onLandmarksCallback?: (landmarks: number[][]) => void;
    private isInitialized = false;
    
    // Add smoothing state
    private smoothedLandmarks: number[][] | null = null;
    private smoothingFactor: number = 0.3; // Adjustable: 0 = no smoothing, 1 = full smoothing
  
    constructor(videoElement: HTMLVideoElement, onLandmarks?: (landmarks: number[][]) => void, smoothingFactor: number = 0.3) {
      this.onLandmarksCallback = onLandmarks;
      this.smoothingFactor = Math.max(0, Math.min(1, smoothingFactor));
      
      this.videoElement = videoElement;
      this.videoElement.requestVideoFrameCallback(this.onFrameCallback);
      this.videoElement.onplay = () => {
        // console.log("onplay");
        this.videoElement.requestVideoFrameCallback(this.onFrameCallback);
      }
      // Initialize MediaPipe components asynchronously
      this.initializeMediaPipe();
    }

    private onFrameCallback = async () => {
      // console.log("requestVideoFrameCallback");
      this.faceMesh.send({ image: this.videoElement });
      this.videoElement.requestVideoFrameCallback(this.onFrameCallback);
    }
  
    private async initializeMediaPipe() {
      try {
        const [{ FaceMesh }] = await Promise.all([
          import('@mediapipe/face_mesh'),
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
          // console.log("onResults", results);
          if (results.multiFaceLandmarks && this.onLandmarksCallback) {
            const regularizedLandmarks = this.regularizeLandmarks(results.multiFaceLandmarks[0]);
            this.onLandmarksCallback(regularizedLandmarks);
          }
        });
  
        this.isInitialized = true;
      } catch (error) {
        console.error('Failed to initialize MediaPipe:', error);
      }
    }
  
    private regularizeLandmarks(landmarks: FaceLandmarks[], imageScale: number = 1): number[][] {
      // Calculate face center
      if (!landmarks) return [];


      // return landmarks.map(l => [l.x*1000,-l.y*1000]);

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
  
    setOnLandmarksCallback(callback: (landmarks: number[][]) => void): void {
      this.onLandmarksCallback = callback;
    }
  }
  
  export default FaceMeshMovie;
import { Component, createSignal } from "solid-js";
import PareidoliaCore from "../../../components/ui/pareidolia/PareidoliaCore";
import CameraTPS from "../../camera/lib/CameraTPS";
import FaceMeshCamera from "../../camera/lib/Camera";
import TPS from "../../../tps/TPS";
import Face from "../../../components/ui/face/Face";

const PareidoliaCam: Component<{}> = (props) => {
    let cameraLandmarks: number[][] | undefined;
  let faceRef: typeof Face | undefined;
    let faceSvgRef: SVGSVGElement | undefined;

  const [currentTPS, setCurrentTPS] = createSignal<any>(null);
  const [originalImageData, setOriginalImageData] = createSignal<ImageData | null>(null);
  const [isThinking, setIsThinking] = createSignal(false);
  const [displayPoints, setDisplayPoints] = createSignal<number[][]>([]);
  const [currentLayer, setCurrentLayer] = createSignal("basics");

    // Performance optimization constants
  const PROCESSING_SCALE = 1;

    const faceMeshCamera = new FaceMeshCamera(async (landmarks) => {
        if (landmarks.length > 0 && !cameraLandmarks) {
            cameraLandmarks = landmarks;
            return;
        }
    if (!currentTPS() || !landmarks) return;
        
    if (!currentTPS().updateActiveTargets(landmarks)) {
            return;
        }
        requestAnimationFrame(() => {
            try {
        currentTPS().drawGPU();
                console.log("GPU");
            }
            catch (e) {
        currentTPS().draw(); // Fallback to CPU only if GPU fails
                console.log("CPU fallback");
            }
    });
  });

  const handleFeatureComplete = (feature: string, points: any[]) => {
    // Handle feature completion if needed
  };

  const handleImageProcessed = (imageData: ImageData) => {
    setOriginalImageData(imageData);
  };

  const handleProcessImage = () => {
    if (currentTPS()) {
      currentTPS()?.destroy();
      setCurrentTPS(null);
    }

    const imageLandmarks = new Map();
    // This would need to be implemented based on the fixed points
    // For now, this is a placeholder
    
    const tps = new CameraTPS(imageLandmarks, cameraLandmarks, originalImageData(), PROCESSING_SCALE);
    setCurrentTPS(tps);
  };

  const handleViewPoints = () => {
    // Toggle point visibility
  };

    return (
    <PareidoliaCore
      controls={{
        render: (props) => (
            <div style={{display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", "width": "300px" }}>
            <h1>Pareidolia</h1>
            <div id="controls">
                <div style={{position: "relative"}}>
                <Face id="face" ref={faceRef} width={140} height={140}/>
                <svg id="face-svg" ref={faceSvgRef} width={140} height={140} style={{position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)"}}></svg>
                </div>
                <h4>Layers</h4>
                <div id="layers">
                <input type="button" value="Mask" onClick={() => setCurrentLayer("mask")} />
                <input type="button" value="Basics" onClick={() => setCurrentLayer("basics")} />
                </div>
              <h4>{props.featureName}</h4>
              <div>Drag and drop an image to get started.</div>
              <input type="button" value="Back" onClick={props.onBack} />
              <input type="button" value="Skip" onClick={props.onSkip} />
              <input type="button" value="Next" onClick={props.onNext} />
                    <br />
              <input type="button" value="Do it!" onClick={handleProcessImage} />
                    <h4>Camera</h4>
                    <input type="button" value="Start" onClick={() => {
                        faceMeshCamera.start().catch(error => {
                            console.error('Failed to start camera:', error);
                        });
                    }} />
                    <input type="button" value="Stop" onClick={() => {
                        faceMeshCamera.stop();
                    }} />  
                    <br />
              <input type="button" value="View Points" onClick={handleViewPoints} />    
            </div>
        </div>
        )
      }}
      tpsConfig={{
        create: (landmarks, imageData) => {
          const tps = new CameraTPS(landmarks, cameraLandmarks, imageData, PROCESSING_SCALE);
          setCurrentTPS(tps);
          return tps;
        },
        update: (tps, landmarks) => {
          tps.updateActiveTargets(landmarks);
        },
        destroy: (tps) => {
          tps.destroy();
          setCurrentTPS(null);
        }
      }}
      onFeatureComplete={handleFeatureComplete}
      onImageProcessed={handleImageProcessed}
    />
    );
}

export default PareidoliaCam;
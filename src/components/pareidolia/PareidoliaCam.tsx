import { Component, createSignal } from "solid-js";
import PareidoliaCore from "./PareidoliaCore";
import CameraTPS from "../../lib/pareidolia/CameraTPS";
import FaceMeshCamera from "../../lib/pareidolia/Camera";
import Face from "../threejs/Face";

const PareidoliaCam: Component<{}> = (props) => {
  let cameraLandmarks: number[][] | undefined;
  let faceRef: typeof Face | undefined;
  let faceSvgRef: SVGSVGElement | undefined;

  const [cameraTPS, setCameraTPS] = createSignal<CameraTPS | null>(null);
  const [originalImageData, setOriginalImageData] =
    createSignal<ImageData | null>(null);
  const [isThinking, setIsThinking] = createSignal<boolean>(false);
  const [displayPoints, setDisplayPoints] = createSignal<number[][]>([]);
  const [currentLayer, setCurrentLayer] = createSignal("basics");

  // Performance optimization constants
  const PROCESSING_SCALE = 1;

  const faceMeshCamera = new FaceMeshCamera(async (landmarks) => {
    // capture first frame and save as reference, don't draw
    if (landmarks.length > 0 && !cameraTPS()) {
      cameraLandmarks = landmarks;
      return;
    }

    // only process one frame at a time, let frames drop
    if (isThinking() || !cameraTPS() || !landmarks) return;

    setIsThinking(true);

    if (!cameraTPS().updateActiveTargets(landmarks)) {
      console.log("TPS Error");
      //don't continue if there was a calculation problem
      setIsThinking(false);
      return;
    }

    requestAnimationFrame(async () => {
      try {
        // throw new Error("test");
        await cameraTPS().drawGPU();
        // console.log("GPU");
      } catch (e) {
        // cameraTPS().draw(); // Fallback to CPU only if GPU fails
        // console.log("CPU fallback");
      } finally {
        // console.log("finally", isWorking, isThinking());
        setIsThinking(false);
      }
    });
  });

  return (
    <PareidoliaCore
      controls={{
        render: (props) => (
          <>
              <h4>Camera</h4>
              <input
                type="button"
                value="Start"
                onClick={() => {
                  faceMeshCamera.start().catch((error) => {
                    console.error("Failed to start camera:", error);
                  });
                }}
              />
              <input
                type="button"
                value="Stop"
                onClick={() => {
                  faceMeshCamera.stop();
                }}
              />
              <br/>
              Center Face
              <input type="checkbox" value="Center Face" onClick={(e) => {
                faceMeshCamera.setCenterFace((e.target as HTMLInputElement).checked);
              }} checked/>
              <br/>
              Stabilize Face Y
              <input type="checkbox" onClick={(e) => {
                faceMeshCamera.setStabilizeFaceY((e.target as HTMLInputElement).checked);
              }} checked/>
              <br/>
              Stabilize Face X
              <input type="checkbox" onClick={(e) => {
                faceMeshCamera.setStabilizeFaceX((e.target as HTMLInputElement).checked);
              }} checked/>
              <br/>
              Stabilize Face Z
              <input type="checkbox" onClick={(e) => {
                faceMeshCamera.setStabilizeFaceZ((e.target as HTMLInputElement).checked);
              }} checked/>
              <br/>
              Smoothing —&nbsp;
              <input type="range" onInput={(e) => {
                faceMeshCamera.setSmoothingFactor(parseFloat((e.target as HTMLInputElement).value));
              }} min="0" max="1" step="0.01" value="0.7"/>
            </>
        ),
      }}
      tpsConfig={{
        create: (landmarks, imageData, blurMask, imageBBox) => {
          const tps = new CameraTPS(
            landmarks,
            cameraLandmarks,
            imageData,
            blurMask,
            imageBBox,
            PROCESSING_SCALE
          );
          setCameraTPS(tps);
          return tps;
        },
        update: (tps, landmarks) => {
          // tps.updateActiveTargets(landmarks);
        },
        destroy: (tps) => {
          tps.destroy();
          setCameraTPS(null);
        },
      }}
      setOriginalImageData={setOriginalImageData}
    />
  );
};

export default PareidoliaCam;

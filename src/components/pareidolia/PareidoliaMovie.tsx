import { Component, createSignal } from "solid-js";
import PareidoliaCore from "./PareidoliaCore";
import CameraTPS from "../../lib/pareidolia/CameraTPS";
import Face from "../threejs/Face";
import FaceMeshMovie from "../../lib/pareidolia/Movie";
import { onMount } from "solid-js";

const PareidoliaMovie: Component<{}> = (props) => {
  let cameraLandmarks: number[][] | undefined;
  let faceRef: typeof Face | undefined;
  let faceSvgRef: SVGSVGElement | undefined;
  let movieRef: HTMLVideoElement | undefined;
  const [currentTPS, setCurrentTPS] = createSignal<any>(null);
  const [originalImageData, setOriginalImageData] =
    createSignal<ImageData | null>(null);
  const [isThinking, setIsThinking] = createSignal(false);
  const [displayPoints, setDisplayPoints] = createSignal<number[][]>([]);
  const [currentLayer, setCurrentLayer] = createSignal("basics");

  // Performance optimization constants
  const PROCESSING_SCALE = 1;

  onMount(() => {
    movieRef.onloadeddata = (evt) => {
      let video = evt.target as HTMLVideoElement;
    
      movieRef.width = video.videoWidth;
      movieRef.height = video.videoHeight;
    
      movieRef.loop = true;
    }
    const faceMeshMovie = new FaceMeshMovie(movieRef, async (landmarks) => {
      if (landmarks.length > 0 && !cameraLandmarks) {
        cameraLandmarks = landmarks;
        return;
      }
      
      if (isThinking() || !currentTPS() || !landmarks) return;

      setIsThinking(true);
      if (!currentTPS().updateActiveTargets(landmarks)) {
        setIsThinking(false);
        return;
      }
      requestAnimationFrame(async () => {
        // await faceMeshMovie.faceMesh.send({ image: movieRef });
        try {
          await currentTPS().drawGPU();
        } catch (e) {
          currentTPS().draw(); // Fallback to CPU only if GPU fails
          // console.log("CPU fallback");
        } finally {
          setIsThinking(false);
        }
      });
    });
  });

  const handleFeatureComplete = (feature: string, points: any[]) => {
    console.log("featureComplete", feature, points);
    // Handle feature completion if needed
  };

  const handleImageProcessed = (imageData: ImageData) => {
    console.log("imageProcessed", imageData);
    setOriginalImageData(imageData);
  };

  const handleViewPoints = () => {
    // Toggle point visibility
    console.log("viewPoints");
  };

  return (
    <>
    <PareidoliaCore
      controls={{
        render: (props) => (
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              width: "300px",
            }}
          >
            <h1>Pareidolia</h1>
            <div id="controls">
              <div style={{ position: "relative" }}>
                <Face id="face" ref={faceRef} width={140} height={140} />
                <svg
                  id="face-svg"
                  ref={faceSvgRef}
                  width={140}
                  height={140}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                ></svg>
              </div>
              <h4>Layers</h4>
              <div id="layers">
                <input
                  type="button"
                  value="Mask"
                  onClick={() => setCurrentLayer("mask")}
                />
                <input
                  type="button"
                  value="Basics"
                  onClick={() => setCurrentLayer("basics")}
                />
              </div>
              <h4>{props.featureName}</h4>
              <div>Drag and drop an image to get started.</div>
              <input type="button" value="Back" onClick={props.onBack} />
              <input type="button" value="Skip" onClick={props.onSkip} />
              <input type="button" value="Next" onClick={props.onNext} />
              <br />
              <input
                type="button"
                value="Do it!"
                onClick={function() {
                  movieRef.play();
                  // handleProcessImage();
                  props.onProcess();
                }}
              />
              <input
                type="button"
                value="View Points"
                onClick={handleViewPoints}
              />
            </div>
          </div>
        ),
      }}
      tpsConfig={{
        create: (landmarks, imageData) => {
          const tps = new CameraTPS(
            landmarks,
            cameraLandmarks,
            imageData,
            PROCESSING_SCALE
          );
          setCurrentTPS(tps);
          console.log("created tps", tps);
          return tps;
        },
        update: (tps, landmarks) => {
          // tps.updateActiveTargets(landmarks);
        },
        destroy: (tps) => {
          tps.destroy();
          setCurrentTPS(null);
        },
      }}
      onFeatureComplete={handleFeatureComplete}
      onImageProcessed={handleImageProcessed}
    />
    <video id="movie" ref={movieRef} src="/demo/giulietta.mp4" width={140} height={140} />
    </>
  );
};

export default PareidoliaMovie;

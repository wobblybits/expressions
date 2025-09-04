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
    };
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

  return (
    <PareidoliaCore
      controls={{
        render: (props) => (
          <video
            id="movie"
            ref={movieRef}
            src="/demo/giulietta.mp4"
            width={140}
            height={140}
          />
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
      setOriginalImageData={setOriginalImageData}
    />
  );
};

export default PareidoliaMovie;

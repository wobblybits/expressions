import type { Component } from "solid-js";
import * as THREE from "three";
import ExpressionModel from "../../lib/threejs/ExpressionModel";
import EmotionModel, {
  NoEmotion,
  type EmotionLevels,
  randomExpression,
} from "../../lib/EmotionModel";
import Scene from "../../lib/threejs/Scene";
import FaceMeshCamera from "../../lib/pareidolia/Camera";
import Controls from "../ui/Controls";
import { onMount } from "solid-js";

const Mesh: Component<{
  id: string;
  width: number;
  height: number;
  expressionModel?: ExpressionModel;
}> = (props) => {
  const scene = new Scene(props.width, props.height);
  const expressionModel =
    props.expressionModel || new ExpressionModel(new EmotionModel());
  let expression: THREE.Object3D | undefined;

  let isThinking = false;

  const faceMeshCamera = new FaceMeshCamera(async (landmarks) => {
    // capture first frame and save as reference, don't draw

    // only process one frame at a time, let frames drop
    if (isThinking || !landmarks) return;

    isThinking = true;

    requestAnimationFrame(async () => {
      try {
        // throw new Error("test");
        draw(convertLandmarks(landmarks));
        // console.log("GPU");
      } catch (e) {
        console.error(e);
        // cameraTPS().draw(); // Fallback to CPU only if GPU fails
        // console.log("CPU fallback");
      } finally {
        // console.log("finally", isWorking, isThinking());
        isThinking = false;
      }
    });
  });

  const convertLandmarks = (landmarks: number[][]) => {
    return landmarks.flat();
  };

  const draw = (coordinates: number[]) => {
    expression = expressionModel.createExpression(coordinates);
    if (!expression) {
      console.warn("draw: expression is undefined");
      return;
    }
    for (var i = 1; i < expression.children.length; i++) {
      // console.log(expression.children[i]);
      const pupil = expression.children[i];
      pupil.position.set(pupil.position.x, pupil.position.y, pupil.position.z);
    }
    scene.add(expression);
    scene.render();
  };

  return (
    <div>
      <div
        id={props.id}
        class="face pixelated-border"
        style={{ width: props.width + "px", height: props.height + "px" }}
      >
        {scene.renderer.domElement}
        <div class="halftone"></div>
      </div>
      <Controls
        title="Demo"
        emotionModel={expressionModel.emotionModel}
        callback={() => {}}
      >
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
          <br />
          Center Face
          <input
            type="checkbox"
            value="Center Face"
            onClick={(e) => {
              faceMeshCamera.setCenterFace(
                (e.target as HTMLInputElement).checked
              );
            }}
            checked
          />
          <br />
          Stabilize Face Y
          <input
            type="checkbox"
            onClick={(e) => {
              faceMeshCamera.setStabilizeFaceY(
                (e.target as HTMLInputElement).checked
              );
            }}
            checked
          />
          <br />
          Stabilize Face X
          <input
            type="checkbox"
            onClick={(e) => {
              faceMeshCamera.setStabilizeFaceX(
                (e.target as HTMLInputElement).checked
              );
            }}
            checked
          />
          <br />
          Stabilize Face Z
          <input
            type="checkbox"
            onClick={(e) => {
              faceMeshCamera.setStabilizeFaceZ(
                (e.target as HTMLInputElement).checked
              );
            }}
            checked
          />
          <br />
          Smoothing —&nbsp;
          <input
            type="range"
            onInput={(e) => {
              faceMeshCamera.setSmoothingFactor(
                parseFloat((e.target as HTMLInputElement).value)
              );
            }}
            min="0"
            max="1"
            step="0.01"
            value="0.7"
          />
        </>
      </Controls>
    </div>
  );
};

export default Mesh;

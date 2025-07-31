import type { Component } from 'solid-js';
import * as THREE from 'three';
import ExpressionModel from '../lib/ExpressionModel';
import { NoEmotion, type EmotionLevels } from '../lib/EmotionModel';
import Scene from '../lib/Scene';
import { createEffect, createSignal } from 'solid-js';

const Face: Component<{ id: string, width: number, height: number, expressionModel: ExpressionModel, emotionLevels?: EmotionLevels | number[] | (() => EmotionLevels) , rotation?: number[] }> = (props) => {
    const scene = new Scene(props.width, props.height);
    scene.renderer.setPixelRatio(1);
    const expressionModel = props.expressionModel;
    let expression: THREE.Object3D | undefined;
    let rotation = props.rotation || [0, 0, 0];

    // Create a signal for the image src
    const [imageSrc, setImageSrc] = createSignal('');

    const draw = (facialExpression: EmotionLevels) => {
      const expression = expressionModel.getExpression(facialExpression);
      expression.rotation.set(...rotation);
      scene.add(expression);
      scene.render();
      
      // Update the signal instead of directly setting image.src
      setImageSrc(scene.renderer.domElement.toDataURL());
    }

    // Use createEffect to react to emotionLevels changes
    createEffect(() => {
      const emotionLevels = {...NoEmotion, ...(typeof props.emotionLevels === 'function' ? props.emotionLevels() : props.emotionLevels)};
      draw(emotionLevels);
    });

    return (
      <div id={props.id} class='face' style={{width: props.width + "px", height: props.height + "px"}}>
        <img src={imageSrc()} alt="Face"/>
        <div class="halftone"></div>
      </div>
    );
  };
  
export default Face;
  

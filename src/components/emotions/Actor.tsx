import type { Component } from 'solid-js';
import * as THREE from 'three';
import ExpressionModel from '../../features/emotions/lib/ExpressionModel';
import EmotionModel, { NoEmotion, type EmotionLevels, randomExpression } from '../../features/emotions/lib/EmotionModel';
import Scene from '../../lib/Scene';

const Actor: Component<{ id: string, width: number, height: number, expressionModel?: ExpressionModel, emotionLevels?: EmotionLevels, rotation?: number[] }> = (props) => {
    const scene = new Scene(props.width, props.height);
    const expressionModel = props.expressionModel || new ExpressionModel(new EmotionModel());
    let expression: THREE.Object3D | undefined;
    let emotionLevels = {...NoEmotion, ...props.emotionLevels || {}};
    let rotation = props.rotation || [0, 0, 0];

    let targetRotation = [0, 0, 0];
    let targetEmotionLevels = {...NoEmotion, ...props.emotionLevels};
    let targetTime = 0;
    let timeDelta = 0;
    let lastTimeChecked = performance.now();

    const animate = () => {
        const currentTime = performance.now();
        timeDelta = currentTime - lastTimeChecked;
        lastTimeChecked = currentTime;  

        targetTime = Math.max(targetTime - timeDelta, 0);

        if (targetTime === 0) {
            return;
        }

        let needsUpdate = false;
        for (const emotion in emotionLevels) {
            if (emotionLevels[emotion] !== targetEmotionLevels[emotion]) {
                emotionLevels[emotion] = emotionLevels[emotion] + (targetEmotionLevels[emotion] - emotionLevels[emotion]) * timeDelta / targetTime;
                needsUpdate = true;
            }
        }
        for (let i = 0; i < rotation.length; i++) {
            if (rotation[i] !== targetRotation[i]) {
                rotation[i] = rotation[i] + (targetRotation[i] - rotation[i]) * timeDelta / targetTime;
                needsUpdate = true;
            }
        }

        draw(); 
        if (needsUpdate) {
            requestAnimationFrame(animate);
        }

    }

    const draw = () => {
        const expression = expressionModel.getExpression(emotionLevels);
        if (!expression) {
            console.warn('draw: expression is undefined');
            return;
        }
        for (var i = 1; i < expression.children.length; i++) {
            // console.log(expression.children[i]);
            const pupil = expression.children[i];
            pupil.position.set(pupil.position.x, pupil.position.y + rotation[0] * .4, pupil.position.z - Math.abs(rotation[1]) * .12 + Math.abs(rotation[0]) * .1);
        }
        expression.rotation.set(rotation[0], rotation[1], rotation[2]);
        scene.add(expression);
        scene.render();
    }

    const update = (newEmotionLevels?: EmotionLevels, newRotation?: number[]) => {
        targetEmotionLevels = {...NoEmotion, ...newEmotionLevels || targetEmotionLevels};
        targetRotation = newRotation || targetRotation;
        targetTime = 500;
        timeDelta = 0;
        lastTimeChecked = performance.now();
        animate();
    }

    const faceDirection = (x: number, y: number) => {
        const newRotation = [0, 0, 0];
        if (x == -1) {
            newRotation[1] = Math.PI/3;
        } else if (x == 1) {
            newRotation[1] = -Math.PI/3;
        } else if (y == -1) {
            newRotation[0] = Math.PI/4;
        } else if (y == 1) {
            newRotation[0] = -Math.PI/4;
        }
        return newRotation;
    }
    
    window.setInterval(() => {  
        update(randomExpression(), faceDirection(Math.round((Math.random() - .5) * 2), Math.round((Math.random() - .5) * 2)));
    }, Math.random() * 1000 + 800);

    draw();

    return (
      <div id={props.id} class='face pixelated-border' style={{width: props.width + "px", height: props.height + "px"}} onMouseDown={() => update(randomExpression(), [0, Math.random() - .5, 0])}>
        {scene.renderer.domElement}
        <div class="halftone"></div>
      </div>
    );
  };
  
export default Actor;
  

import type { Component } from 'solid-js';
import * as THREE from 'three';
import ExpressionModel from '../lib/ExpressionModel';
import { NoEmotion, type EmotionLevels } from '../lib/EmotionModel';
import Scene from '../../../lib/Scene';
import Face from '../../../components/ui/face/Face';
import { For, createSignal, onMount } from 'solid-js';
import Agent from '../lib/Agent';

let learningRate = 1;
let updateInterval = 400;
const idealState = Object.keys(NoEmotion).reduce((acc, key) => {
    acc[key] = Math.random() * 80 - 40;
    return acc;
}, {} as EmotionLevels);
let levelScale = 40;
let idealVector = [...Object.keys(idealState).map((key) => idealState[key as keyof EmotionLevels] / levelScale)];
let extroversion = 1;

const Game: Component<{ id: string, width: number, height: number, expressionModel: ExpressionModel, gridSize: number }> = (props) => {
    const scene = new Scene(props.width, props.height);
    scene.camera = new THREE.OrthographicCamera( -2.5 * props.gridSize, 2.5 * props.gridSize, 2.5 * props.gridSize, -2.5 * props.gridSize, 0.01, 100 );
    scene.camera.position.set( ...([2.5 * (props.gridSize - 1), 2.5 * (props.gridSize - 1), 10]) );
    scene.camera.updateProjectionMatrix();

    let zoom = props.gridSize * 1.25;
    let lastMousePosition = { x: 0, y: 0 };

    let isDragging = false;
    scene.renderer.domElement.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        isDragging = true;
        lastMousePosition = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', (e) => {
        e.preventDefault();
        isDragging = false;
    });
    window.addEventListener('pointercancel', (e) => {
        e.preventDefault();
        isDragging = false;
    });
    scene.renderer.domElement.addEventListener('pointermove', (e) => {
        e.preventDefault();
        if (isDragging) {
            // Calculate the world-to-screen ratio based on current camera frustum
            const worldToScreenRatio = (scene.camera.right - scene.camera.left) / scene.renderer.domElement.width;
            
            // Calculate world space movement based on screen-to-world ratio
            const worldSpaceMovementX = -e.movementX * worldToScreenRatio;
            const worldSpaceMovementY = e.movementY * worldToScreenRatio;
            
            scene.camera.position.x += worldSpaceMovementX;
            scene.camera.position.y += worldSpaceMovementY;
        }
        lastMousePosition = { x: e.clientX, y: e.clientY };
    });
    scene.renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Get mouse position in normalized device coordinates (-1 to +1)
        const rect = scene.renderer.domElement.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Create a vector for the mouse position in world space
        const mouseVector = new THREE.Vector3(mouseX, mouseY, 0);
        mouseVector.unproject(scene.camera);
        mouseVector.z = 0; // Project to the z=0 plane
        
        // Calculate zoom factor
        const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
        const newZoom = zoom * zoomFactor;
        
        // Calculate the world space position of the mouse before zoom
        const worldMouseBefore = mouseVector.clone();
        
        // Apply zoom to camera frustum
        scene.camera.top *= zoomFactor;
        scene.camera.bottom *= zoomFactor;
        scene.camera.left *= zoomFactor;
        scene.camera.right *= zoomFactor;
        scene.camera.updateProjectionMatrix();
        
        // Calculate the world space position of the mouse after zoom
        mouseVector.set(mouseX, mouseY, 0);
        mouseVector.unproject(scene.camera);
        mouseVector.z = 0;
        
        // Adjust camera position to keep the mouse point fixed
        scene.camera.position.x += worldMouseBefore.x - mouseVector.x;
        scene.camera.position.y += worldMouseBefore.y - mouseVector.y;
        
        // Update zoom variable
        zoom = newZoom;
    });
    // const pointLight = new THREE.PointLight( 0x224433, 15, 15, .5 );
    // pointLight.position.set( ...([1.25 * (props.gridSize - 1), 2.5 * (props.gridSize - 1), 10]));
    // scene.scene.add( pointLight );

    const expressionModel = props.expressionModel;

    let agents = [];
    let timeDelta = 0;
    let lastTimeChecked = performance.now();
    let targetTime = 0;
    let isUpdating = false;
    let isInitialized = false;

    // Create web worker for agent initialization
    const worker = new Worker(new URL('../lib/AgentWorker.ts', import.meta.url), { type: 'module' });

    // Handle worker messages
    worker.onmessage = (e) => {
        if (e.data.type === 'agents-created') {
            // Reconstruct agents from worker data
            agents = e.data.agents.map(agentData => {
                const agent = new Agent(agentData.id, agentData.row, agentData.column);
                agent.internalState = agentData.internalState;
                agent.bias = agentData.bias;
                agent.transitions = agentData.transitions;
                agent.rotation = agentData.rotation;
                agent.targetRotation = agentData.targetRotation;
                agent.targetState = agentData.targetState;
                agent.dim = agentData.dim;
                agent.isPaired = agentData.isPaired;
                return agent;
            });
            
            document.getElementById('loading')?.remove();
            isInitialized = true;
            // Start animation once agents are created
            animate();
        }
    };

    // Initialize agents in worker
    worker.postMessage({ type: 'init', data: { gridSize: props.gridSize } });

    const animate = () => {
        if (!isInitialized) {
            requestAnimationFrame(animate);
            return;
        }

        if (targetTime <= 0) {
            update();
            return;
        }
        const currentTime = performance.now();
        timeDelta = currentTime - lastTimeChecked;
        lastTimeChecked = currentTime;  
        let increment = Math.max(0, Math.min(1, targetTime > 0 ? timeDelta / targetTime : 0));
        
        for (const agent of agents) {
            agent.update(increment);
        }

        draw();

        targetTime = Math.max(targetTime - timeDelta, 0);

        requestAnimationFrame(animate);
    }

    const draw = () => {
        // Clear the scene before adding new objects
        scene.scene.clear();
        
        // Re-add lights after clearing
        const ambientLight = new THREE.AmbientLight(0xaa0077, 3);
        const overheadLight = new THREE.DirectionalLight(0xcc99aa, 1);
        overheadLight.position.set(-2, 4.5, 9);
        const sideLight = new THREE.DirectionalLight(0x99aacc, 4);
        sideLight.position.set(3, 3, 5);
        
        scene.scene.add(ambientLight);
        scene.scene.add(overheadLight);
        scene.scene.add(sideLight);
        
        for (const agent of agents) {
            const expression = agent.getExpression(levelScale); 
            scene.add(expression);
        }
        
        scene.render(); // Use normal scene render instead of composer
    }

    const update = () => {
        for (const agent of agents) {
            agent.isPaired = false;
        }
        for (var i = 0; i < props.gridSize; i++) {
            for (var j = 0; j < props.gridSize; j++) {
                const agent = agents[i * props.gridSize + j];
                if (!agent.isPaired) {
                    let notPaired = true;
                    let attempts = 0;
                    while (notPaired && attempts < extroversion) {
                        attempts++;
                        let dx = Math.round(Math.random() * 2.98 - 1.49);
                        let dy = Math.round(Math.random() * 2.98 - 1.49);
                        const j2 = Math.max(0, Math.min(props.gridSize - 1, j + dx));
                        const i2 = Math.max(0, Math.min(props.gridSize - 1, i + dy));  
                        dx = j2 - j;
                        dy = i2 - i;
                        if (dx == 0 && dy == 0) {
                            continue;
                        }
                        const otherAgent = agents[i2 * props.gridSize + j2];
                        if (otherAgent && !otherAgent.isPaired) {
                            agent.interact(otherAgent.internalState, learningRate, idealVector);
                            otherAgent.interact(agent.internalState, learningRate, idealVector);
                            agent.faceDirection(dx, dy);
                            otherAgent.faceDirection(-dx, -dy);
                            notPaired = false;
                        }
                    }
                    if (notPaired) {
                        agent.interact(agent.internalState, learningRate, idealVector);
                        agent.rotate([0, 0, 0]);
                    }
                }
            }
        }
        targetTime = updateInterval;
        requestAnimationFrame(animate);
    }

    // Create a signal to track the current emotion levels
    const [currentEmotionLevels, setCurrentEmotionLevels] = createSignal(idealState);

    return (
      <div id="game-container" style={{position: "relative", "text-align": "center", width: "100%", height: "calc(100% - 2em)", padding: "1em", display: "flex", "flex-direction": "row", "align-items": "center", "justify-content": "center"}}>
        <div id={props.id} class='game pixelated-border' style={{width: props.width + "px", height: props.height + "px", position: "relative"}}>
            {scene.renderer.domElement}
            <div class="halftone"></div>
            <div id="loading">Loading...</div>
        </div>
        <div style={{display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", "width": "300px" }}>
            <h1>Games with Emotions</h1>
            <div id="controls">
                <h4>Homeostasis</h4>
                <Face id="face" width={140} height={140} expressionModel={props.expressionModel} emotionLevels={currentEmotionLevels()}/>
                <For each={Object.keys(NoEmotion)}>
                    {(key) => 
                        <div style={{display: "flex", "align-items": "center", gap: "10px"}}>
                            <input type="range" min="-100" max="100" value={idealState[key as keyof EmotionLevels]} oninput={(e) => {
                                idealState[key as keyof EmotionLevels] = parseInt(e.target.value);
                                idealVector[Object.keys(NoEmotion).indexOf(key)] = idealState[key as keyof EmotionLevels] / levelScale;
                                setCurrentEmotionLevels({...idealState});
                            }}/>
                            <span>{String(key)}</span>
                        </div>
                    }
                </For>
                <h4>Settings</h4>
                <div style={{display: "flex", "align-items": "center", gap: "10px"}}>
                    <input type="range" min="-14" max="0" value={Math.log10(learningRate)} oninput={(e) => {
                        learningRate = 10 **parseInt(e.target.value);
                    }}/>
                    <span>Learning Rate</span>
                </div>
                <div style={{display: "flex", "align-items": "center", gap: "10px"}}>
                    <input type="range" min="100" max="10000" value={10100 - updateInterval} oninput={(e) => {
                        updateInterval = 10100 - parseInt(e.target.value);
                    }}/>
                    <span>Animation Speed</span>
                </div>
                <div style={{display: "flex", "align-items": "center", gap: "10px"}}>
                    <input type="range" min="80" max="1000" value={levelScale} oninput={(e) => {
                        levelScale = parseInt(e.target.value);
                        idealVector = [...Object.keys(idealState).map((key) => idealState[key as keyof EmotionLevels] / levelScale)];
                    }}/>
                    <span>Intensity</span>
                </div>
                <div style={{display: "flex", "align-items": "center", gap: "10px"}}>
                    <input type="range" min="0" max="10" value={extroversion} oninput={(e) => {
                        extroversion = parseInt(e.target.value);
                    }}/>
                    <span>Extroversion</span>
                </div>
            </div>
        </div>
      </div>
    );
  };
  
export default Game;
  

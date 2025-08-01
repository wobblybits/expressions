import { Component, createEffect, createSignal } from "solid-js";
import features from "../data/features.json";
import mediapipe from "../data/mediapipe478.json";
import Controls from "./Controls";
import EmotionModel, { NoEmotion } from "../lib/EmotionModel";
import meanFace from "../data/mean.json";
import CameraTPSMain from "../lib/CameraTPSMain";
import FaceMeshCamera from "../lib/Camera";

const padding = 0;

const PareidoliaCam: Component<{emotionModel: EmotionModel}> = (props) => {

    let cameraLandmarks: number[][] | undefined;

    let canvasRef: HTMLCanvasElement | undefined;
    let ctx: CanvasRenderingContext2D | undefined;
    let svgRef: SVGSVGElement | undefined;
    let containerRef: HTMLDivElement | undefined;

    const { emotionModel } = props;

    const [imageLoaded, setImageLoaded] = createSignal(false);
    const [imageDimensions, setImageDimensions] = createSignal({ width: 600, height: 600 });
    const [displayScale, setDisplayScale] = createSignal(1);
    const [featureName, setFeatureName] = createSignal("Upload an Image");
    
    const fixedPoints = {};
    let currentFeature = 0;
    let originalImageData: ImageData | undefined;
    let currentEmotionLevels = NoEmotion;
    let offsetEmotionLevels = NoEmotion;

    // Performance optimization constants
    const PROCESSING_SCALE = 0.5; // Back to original value
    const WORKER_COUNT = 4;

    const normalizeLandmarks = (landmarks: number[]) => {
        const currentWidth = imageDimensions().width;
        const currentHeight = imageDimensions().height;
        const xCoords = landmarks.filter((d, i) => i % 3 === 0);
        const yCoords = landmarks.filter((d, i) => i % 3 === 1);
        const minX = Math.min(...xCoords);
        const minY = Math.min(...yCoords);
        const maxX = Math.max(...xCoords);
        const maxY = Math.max(...yCoords);
        const scaleX = (currentWidth - 2*padding) / (maxX - minX);
        const scaleY = (currentHeight - 2*padding) / (maxY - minY);
        const normalizedLandmarks = landmarks.map((l, i) => {
            if (i % 3 === 0) return (l - minX) * scaleX + padding;
            if (i % 3 === 1) return currentHeight - ((l - minY) * scaleY + padding);
            return l; // z-coordinate
        });
        return normalizedLandmarks;
    }

    let normalizedLandmarks = normalizeLandmarks(mediapipe.vertices);
    let cameraTPS: CameraTPSMain | null = null;

    const faceMeshCamera = new FaceMeshCamera(async (landmarks) => {
        if (landmarks.length > 0 && !cameraLandmarks) {
            cameraLandmarks = landmarks;
            return;
        }
        if (!cameraTPS || !landmarks) return;
        
        // Process frame with automatic staggering
        const frameProcessed = cameraTPS.processFrame(landmarks);
        
        // Log detailed performance stats periodically
        const stats = cameraTPS.getPerformanceStats();
        if (Math.random() < 0.01) { // Log 1% of the time
            console.log('Performance Stats:', {
                tpsCalculation: `${stats.tpsCalculation.toFixed(2)}ms`,
                imageTransformation: `${stats.imageTransformation.toFixed(2)}ms`,
                total: `${(stats.tpsCalculation + stats.imageTransformation).toFixed(2)}ms`
            });
        }
    });

    let clearSVG = () => {};

    const fixFeature = () => {
        clearSVG();
        const featureName = Object.keys(features)[currentFeature];
        setFeatureName(featureName);

        // drawLandmarks();
    }

    const fixImage = async () => {
        clearSVG();
        if (cameraTPS) {
            cameraTPS.destroy();
        }
        offsetEmotionLevels = {...currentEmotionLevels};

        const imageLandmarks = new Map();
        for (const featureName in fixedPoints) {
            if (features[featureName].path.length == 0 || fixedPoints[featureName].length == 0) {
                continue;
            }
            if (fixedPoints[featureName].length == 1) {
                imageLandmarks.set(features[featureName].path[0], [fixedPoints[featureName][0].x, fixedPoints[featureName][0].y, 0]);
            }
            else if (fixedPoints[featureName].length == 2) {
                imageLandmarks.set(features[featureName].path[0], [fixedPoints[featureName][0].x, fixedPoints[featureName][0].y, 0]);
                imageLandmarks.set(features[featureName].path[1], [fixedPoints[featureName][1].x, fixedPoints[featureName][1].y, 0]);
            }
            else {
                const newPath = normalizePath(fixedPoints[featureName], featureName);
                for (var i = 0; i < features[featureName].path.length; i++) {
                    imageLandmarks.set(features[featureName].path[i], newPath[i]);
                }
            }
        }
        
        cameraTPS = new CameraTPSMain(imageLandmarks, cameraLandmarks);
        
        // Set image data
        cameraTPS.setImageData(originalImageData.data, imageDimensions().width, imageDimensions().height, PROCESSING_SCALE);
        
        // Wait for initialization to complete
        await new Promise<void>((resolve) => {
            const checkInit = () => {
                if (cameraTPS && cameraTPS.initialized) {
                    resolve();
                } else {
                    setTimeout(checkInit, 10);
                }
            };
            checkInit();
        });
        
        cameraTPS.canvas.style.position = 'absolute';
        
        // Position the imageTPS canvas in the same coordinate system as the SVG
        cameraTPS.canvas.style.top = '50%';
        cameraTPS.canvas.style.left = '50%';
        cameraTPS.canvas.style.transform = `translate(${-canvasRef.getBoundingClientRect().width / (2 * displayScale())}px, ${-canvasRef.getBoundingClientRect().height / (2 * displayScale())}px) translate(${cameraTPS.imageBBox.minX}px, ${cameraTPS.imageBBox.minY}px)`;
        cameraTPS.canvas.style.pointerEvents = 'none';
        
        // Insert the canvas after the canvasRef element
        canvasRef.after(cameraTPS.canvas);
    }

    const drawLandmarks = () => {
        if (!svgRef) return;
        
        // Clear existing landmarks
        svgRef.innerHTML = '';
        
        for (const feature in features) {
            const landmarks = features[feature].path;
            const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
            pathElement.setAttribute("d", `M ${landmarks.map((l, i) => normalizedLandmarks.slice(l*3, l*3+2).join(" ")).join(" ")}`);
            svgRef.appendChild(pathElement);
            
            for (const landmark of landmarks) {
                const point = normalizedLandmarks.slice(landmark*3, landmark*3+3);
                const circleElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circleElement.setAttribute("cx", point[0].toString());
                circleElement.setAttribute("cy", point[1].toString());
                circleElement.setAttribute("r", (2/displayScale()).toString());
                circleElement.style.stroke = "red";
                circleElement.style.fill = "red";
                svgRef.appendChild(circleElement);
            }
        }
    }

    const normalizePath = (fixedPointPath: {x: number, y: number}[], feature: string) => {
        const composite = new EmotionModel().calculateCompositeEmotion(currentEmotionLevels);
        const featurePathPoints = features[feature].path.map((l, i) => {
            const index = l*3;
            return [composite[index] + meanFace[index], composite[index+1] - meanFace[index+1], composite[index+2] + meanFace[index+2]];
        });

        if (features[feature].closed) {
            fixedPointPath.push(fixedPointPath[0]);
            featurePathPoints.push(featurePathPoints[0]);
        }

        const featurePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        featurePath.setAttribute("d", `M ${featurePathPoints.map((p, i) => `${p[0]} ${p[1]}`).join(" L ")}`);

        const userPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        userPath.setAttribute("d", `M ${fixedPointPath.map((p, i) => `${p.x} ${p.y}`).join(" L ")}`);
        
        const userPathLength = userPath.getTotalLength();
        const featurePathLength = featurePath.getTotalLength();

        const scale = userPathLength / featurePathLength;

        let userPoint = userPath.getPointAtLength(0);
        const userPathPoints = [[userPoint.x, userPoint.y, 0]];
        let length = 0;
        for (let i = 0; i < featurePathPoints.length - 1; i++) {
            const point = featurePathPoints[i];
            const nextPoint = featurePathPoints[i + 1];
            length += Math.hypot(point[0] - nextPoint[0], point[1] - nextPoint[1]);
            userPoint = userPath.getPointAtLength(length * scale);
            userPathPoints.push([userPoint.x, userPoint.y, 0]);
        }

        console.log(userPathPoints);
        return userPathPoints;
    }

    const calculateDisplayScale = (imageWidth: number, imageHeight: number) => {
        const screenHeight = window.innerHeight;
        const targetHeight = screenHeight * 0.8; // 80% of screen height
        return Math.min(targetHeight / imageHeight, 1); // Don't scale up, only down
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;
        
        const file = files[0];
        if (!file.type.startsWith('image/')) {
            alert('Please drop an image file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Update dimensions
                const newWidth = img.width;
                const newHeight = img.height;
                setImageDimensions({ width: newWidth, height: newHeight });
                
                // Calculate display scale
                const scale = calculateDisplayScale(newWidth, newHeight);
                setDisplayScale(scale);
                
                // Resize canvas (keep original dimensions for pixel-perfect coordinates)
                if (canvasRef) {
                    canvasRef.width = newWidth;
                    canvasRef.height = newHeight;
                    ctx = canvasRef.getContext("2d");
                    
                    // Draw image to canvas
                    ctx?.drawImage(img, 0, 0);
                }
                
                // Resize SVG (keep original dimensions for coordinate mapping)
                if (svgRef) {
                    svgRef.setAttribute('width', newWidth.toString());
                    svgRef.setAttribute('height', newHeight.toString());
                }
                originalImageData = ctx.getImageData(0, 0, newWidth, newHeight);
                setImageLoaded(true);
                normalizedLandmarks = normalizeLandmarks(mediapipe.vertices);
                fixFeature();
                // drawLandmarks();
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    createEffect(() => {
        if (!canvasRef || !svgRef) return;
        ctx = canvasRef.getContext("2d");
        
        // Only set up event handlers when image is loaded
        if (!imageLoaded()) return;
        
        let isDrawing = false;
        let startPoint = {x: 0, y: 0};

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", startPoint.x.toString());
        circle.setAttribute("cy", startPoint.y.toString());
        circle.setAttribute("r", (5/displayScale()).toString());
        circle.style.stroke = "red";
        circle.style.fill = "red";

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", startPoint.x.toString());
        line.setAttribute("y1", startPoint.y.toString());
        line.setAttribute("x2", startPoint.x.toString());
        line.setAttribute("y2", startPoint.y.toString());
        line.style.stroke = "red";
        line.style.fill = "red";

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${startPoint.x} ${startPoint.y} L ${startPoint.x} ${startPoint.y}`);
        path.style.stroke = "red";
        path.style.fill = "rgba(255,0,0,0.2)";

        // Get SVG bounding rect for coordinate conversion
        const getSVGPoint = (e: MouseEvent) => {
            const rect = svgRef!.getBoundingClientRect();
            const x = (e.clientX - rect.left) / displayScale();
            const y = (e.clientY - rect.top) / displayScale();
            return { x, y };
        };

        clearSVG = () => {
            circle.remove();
            line.remove();
            path.remove();
        }

        svgRef.onmousedown = (e) => {
            if (currentFeature == null) return;
            const featureName = Object.keys(features)[currentFeature];
            e.preventDefault();
            e.stopPropagation();
            
            const { x, y } = getSVGPoint(e);
            isDrawing = true;
            startPoint = {x, y};
            fixedPoints[featureName] = [];
            if (features[featureName].path.length == 1) {
                circle.setAttribute("cx", x.toString());
                circle.setAttribute("cy", y.toString());
                svgRef.appendChild(circle);
            }
            else if (features[featureName].path.length == 2) {
                fixedPoints[featureName].push(startPoint);
                line.setAttribute("x1", startPoint.x.toString());
                line.setAttribute("y1", startPoint.y.toString());
                line.setAttribute("x2", startPoint.x.toString());
                line.setAttribute("y2", startPoint.y.toString());
                svgRef.appendChild(line);
            }
            else {
                fixedPoints[featureName].push(startPoint);
                path.setAttribute("d", "M " + fixedPoints[featureName].map((p, i) => `${p.x} ${p.y}`).join(" L "))
                svgRef.appendChild(path);
            }
        }
        
        svgRef.onmousemove = (e) => {
            if (currentFeature == null) return;
            const featureName = Object.keys(features)[currentFeature];
            e.preventDefault();
            e.stopPropagation();
            if (isDrawing) {
                const { x, y } = getSVGPoint(e);
                if (features[featureName].path.length == 1) {
                    circle.setAttribute("cx", x.toString());
                    circle.setAttribute("cy", y.toString());
                }
                else if (features[featureName].path.length == 2) {
                    line.setAttribute("x2", x.toString());
                    line.setAttribute("y2", y.toString());
                }
                else {
                    fixedPoints[featureName].push({x, y});
                    path.setAttribute("d", "M " + fixedPoints[featureName].map((p, i) => `${p.x} ${p.y}`).join(" L "));
                }
            }
        }
        
        svgRef.onmouseup = (e) => {
            if (currentFeature == null) return;
            const featureName = Object.keys(features)[currentFeature];
            e.preventDefault();
            e.stopPropagation();
            isDrawing = false;
            const { x, y } = getSVGPoint(e);
            if (features[featureName].path.length == 1) {
                fixedPoints[featureName].push(startPoint);
            }
            else if (features[featureName].path.length == 2) {
                fixedPoints[featureName].push({x, y});
            }
            else {
                fixedPoints[featureName].push({x, y});
                fixedPoints[featureName].push({x: startPoint.x, y: startPoint.y});
                path.setAttribute("d", "M " + fixedPoints[featureName].map((p, i) => `${p.x} ${p.y}`).join(" L "));
            }
            currentFeature++;
            currentFeature = Math.min(currentFeature, Object.keys(features).length);
            fixFeature();
        }
    });

    return (
        <div 
            id="pareidolia" 
            ref={containerRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
                position: 'relative',
                display: 'flex',
                "flex-direction": "row",
                "align-items": "center",
                "justify-content": "center",
                border: '2px dashed #ccc',
                padding: '10px',
                cursor: 'pointer',
                width: '100vw',
                height: '100vh',
                background: 'rgba(255,0,0,.1)'
            }}
        >
            <div style={{
                position: 'relative',
                display: 'flex',
                "flex-direction": "column",
                "align-items": "center",
                "justify-content": "center",
                transform: `scale(${displayScale()})`,
                'transform-origin': 'center center',
                "flex-grow": 3,
                "flex-shrink": 0,
                width: imageLoaded() ? (imageDimensions().width * displayScale()) + 'px' : 'auto',
                height: imageLoaded() ? (imageDimensions().height * displayScale()) + 'px' : 'auto',
            }}>
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#999',
                    'font-size': '16px',
                    'pointer-events': 'none',
                    display: imageLoaded() ? 'none' : 'block',
                    background: 'white',
                    "z-index": 1000
                }}>
                    Drop an image here
                </div>
                <canvas 
                    id="source" 
                    ref={canvasRef} 
                    width={imageDimensions().width} 
                    height={imageDimensions().height}
                    style={{
                        display: 'block',
                        "box-shadow": imageLoaded() ? `${-.5 / displayScale()}em ${.5 / displayScale()}em 0 rgba(0,0,0,.5), ${-1 / displayScale()}em ${1 / displayScale()}em 0 gray` : 'none',
                    }}
                ></canvas>
                <svg 
                    id="landmarks" 
                    ref={svgRef} 
                    xmlns="http://www.w3.org/2000/svg" 
                    width={imageDimensions().width} 
                    height={imageDimensions().height}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        'pointer-events': imageLoaded() ? 'auto' : 'none', // Enable pointer events when image is loaded
                        "stroke-width": `${5/displayScale()}px`,
                        "stroke": "blue",
                        "fill": "rgba(255,255,255,0.4)",
                        filter: "invert(1)"
                    }}
                ></svg>
            </div>
            <Controls title="Pareidolia" emotionModel={emotionModel} callback={(emotionLevels) => {
                currentEmotionLevels = emotionLevels;
            }}>
                <h4>{featureName() in features ? features[featureName()].name : "Upload an Image"}</h4>
                <div>{featureName() in features ? features[featureName()].description : "Drag and drop an image to get started."}</div>
                <input type="button" value="Back" onClick={() => {
                    currentFeature = Math.max(0, currentFeature - 1);
                    fixFeature();
                }} />
                <input type="button" value="Skip" onClick={() => {
                    fixedPoints[featureName()] = [];
                    currentFeature++;
                    if (currentFeature >= Object.keys(features).length) {
                        currentFeature = 0;
                    }
                    fixFeature();
                }} />
                <input type="button" value="Next" onClick={() => {
                    currentFeature++;
                    if (currentFeature >= Object.keys(features).length) {
                        currentFeature = 0;
                    }
                    fixFeature();
                }} />
                <br />
                <input type="button" value="Do it!" onClick={() => {
                    fixImage();
                }} />
                <h4>Camera</h4>
                <input type="button" value="Start" onClick={() => {
                    faceMeshCamera.start().catch(error => {
                        console.error('Failed to start camera:', error);
                    });
                }} />
                <input type="button" value="Stop" onClick={() => {
                    faceMeshCamera.stop();
                }} />
                
            </Controls>
        </div>
    );
}

export default PareidoliaCam;
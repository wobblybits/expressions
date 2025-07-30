import { Component, createEffect, createSignal, For } from "solid-js";
import { NoEmotion, randomExpression, type EmotionLevels } from "../lib/EmotionModel";
import { TPS } from 'transformation-models';
import monkeyLandmarks from "../data/monkey2_mp478.json";
import faceLandmarks from "../data/mean.json";
import EmotionModel from "../lib/EmotionModel";
import Face from "./Face";
import ExpressionModel from "../lib/ExpressionModel";

const faceXY = new Array(468).fill(0);
const monkeyXY = new Array(468).fill(0);

const monkeyBBox = {
  minX: 700,
  maxX: 0,
  minY: 467,
  maxY: 0,
}

const faceBBox = {
  minX: Infinity,
  maxX: -Infinity,
  minY: Infinity,
  maxY: -Infinity,
  minZ: Infinity,
  maxZ: -Infinity,
}

for (let i = 0; i < 468; i++) {
  faceXY[i] = [faceLandmarks[i*3], faceLandmarks[i*3+1], faceLandmarks[i*3+2]];
  faceBBox.minX = Math.floor(Math.min(faceBBox.minX, faceLandmarks[i*3]));
  faceBBox.maxX = Math.ceil(Math.max(faceBBox.maxX, faceLandmarks[i*3]));
  faceBBox.minY = Math.floor(Math.min(faceBBox.minY, faceLandmarks[i*3+1]));
  faceBBox.maxY = Math.ceil(Math.max(faceBBox.maxY, faceLandmarks[i*3+1]));
  faceBBox.minZ = Math.floor(Math.min(faceBBox.minZ, faceLandmarks[i*3+2]));
  faceBBox.maxZ = Math.ceil(Math.max(faceBBox.maxZ, faceLandmarks[i*3+2]));

  monkeyXY[i] = [monkeyLandmarks[i*3], monkeyLandmarks[i*3+1], monkeyLandmarks[i*3+2]];
  monkeyBBox.minX = Math.floor(Math.min(monkeyBBox.minX, monkeyLandmarks[i*3]));
  monkeyBBox.maxX = Math.ceil(Math.max(monkeyBBox.maxX, monkeyLandmarks[i*3]));
  monkeyBBox.minY = Math.floor(Math.min(monkeyBBox.minY, monkeyLandmarks[i*3+1]));
  monkeyBBox.maxY = Math.ceil(Math.max(monkeyBBox.maxY, monkeyLandmarks[i*3+1]));
}
const mean2monkey = new TPS(faceXY, monkeyXY);

// Helper function to calculate cross product of three points
const crossProduct = (p1: number[], p2: number[], p3: number[]): number => {
  return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
};

// Helper function to calculate distance between two points
const distance = (p1: number[], p2: number[]): number => {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
};

// Function to calculate convex hull using Graham's scan algorithm
const calculateConvexHull = (points: number[][]): number[][] => {
  if (points.length < 3) return points;
  
  // Find the point with the lowest y-coordinate (and leftmost if tied)
  let lowest = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] < points[lowest][1] || 
        (points[i][1] === points[lowest][1] && points[i][0] < points[lowest][0])) {
      lowest = i;
    }
  }
  
  // Sort points by polar angle with respect to the lowest point
  const start = points[lowest];
  const sortedPoints = points
    .filter((_, i) => i !== lowest)
    .sort((a, b) => {
      const angleA = Math.atan2(a[1] - start[1], a[0] - start[0]);
      const angleB = Math.atan2(b[1] - start[1], b[0] - start[0]);
      if (angleA !== angleB) return angleA - angleB;
      return distance(start, a) - distance(start, b);
    });
  
  // Graham's scan
  const hull: number[][] = [start];
  for (const point of sortedPoints) {
    while (hull.length > 1 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
    }
    hull.push(point);
  }
  
  return hull;
};

// Function to check if a point lies within the convex hull
const isPointInConvexHull = (point: number[], hull: number[][]): boolean => {
  if (hull.length < 3) return false;
  
  // Check if point is on the same side of all edges
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
    const cross = crossProduct(p1, p2, point);
    
    // If cross product is negative, point is outside
    if (cross < 0) return false;
  }
  
  return true;
};

// Calculate the convex hull of monkeyXY
const monkeyConvexHull = calculateConvexHull(monkeyXY);

const BAYER_MATRIX = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

// Distribute error to neighboring pixels (Floyd-Steinberg)
const errorDistribution = [
  [1, 0, 7/16],   // right
  [-1, 1, 3/16],  // bottom-left
  [0, 1, 5/16],   // bottom
  [1, 1, 1/16]    // bottom-right
];

const ImageTSP: Component<{ emotionModel: EmotionModel, emotionLevels?: EmotionLevels | number[] }> = (props) => {
    // Create a signal for the image src

    let canvasRef: HTMLCanvasElement | undefined;
    let ctx: CanvasRenderingContext2D | undefined;
    let imageData: Uint8ClampedArray = new Uint8ClampedArray(700 * 467 * 4);

    const nilpotentTPS = new TPS(faceXY, faceXY);

    let previousTPS = nilpotentTPS;
    let emotion2face = nilpotentTPS;
    let lastTime = performance.now();
    let timeDelta = 0;
    let targetTime = 8000;

    let maskedBGData = new Uint8ClampedArray(700 * 467 * 4).fill(0);

    // Add transformation map storage
    let transformationMap = new Map();
    let previousTransformationMap = new Map();

    let emotionLevels = {...NoEmotion, ...props.emotionLevels};
    const [currentEmotionLevels, setCurrentEmotionLevels] = createSignal(emotionLevels);
    
    // Remove web worker code and revert to synchronous approach
    const precomputeTransformationMaps = (tps: TPS): Map<string, number[]> => {
      const map = new Map();
      for (let y = monkeyBBox.minY; y < monkeyBBox.maxY; y++) {
        for (let x = monkeyBBox.minX; x < monkeyBBox.maxX; x++) {
          const key = `${x},${y}`;
          const transform = mean2monkey.forward(tps.inverse(mean2monkey.inverse([x, y, 0])));
          map.set(key, transform);
        }
      }
      return map;
    };

    let isAnimating = false;
    let nextTSP = nilpotentTPS;
    let nextTransformationMap = new Map();

    const startNextAnimation = () => {
      lastTime = performance.now();
      timeDelta = 0;
      isAnimating = true;
      previousTransformationMap = transformationMap;
      previousTPS = emotion2face;
      transformationMap = nextTransformationMap;
      emotion2face = nextTSP;
      getEmotionTSP(randomExpression());
      requestAnimationFrame(animate);
    }

    // Revert getEmotionTSP to synchronous
    const getEmotionTSP = (emotionLevels: EmotionLevels) => {
      emotionLevels = {...NoEmotion, ...emotionLevels};
      setCurrentEmotionLevels(emotionLevels);
      const compositeEmotion = props.emotionModel.calculateCompositeEmotion(emotionLevels);

      const emotionXY = new Array(468).fill(0);
      const emotionBBox = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
      }
      for (let i = 0; i < 468; i++) {
        emotionXY[i] = [compositeEmotion[i*3] + faceXY[i][0], compositeEmotion[i*3+1] - faceXY[i][1], compositeEmotion[i*3+2] + faceXY[i][2]];
        emotionBBox.minX = Math.floor(Math.min(emotionBBox.minX, emotionXY[i][0]));
        emotionBBox.maxX = Math.ceil(Math.max(emotionBBox.maxX, emotionXY[i][0]));
        emotionBBox.minY = Math.floor(Math.min(emotionBBox.minY, emotionXY[i][1]));
        emotionBBox.maxY = Math.ceil(Math.max(emotionBBox.maxY, emotionXY[i][1]));
        emotionBBox.minZ = Math.floor(Math.min(emotionBBox.minZ, emotionXY[i][2]));
        emotionBBox.maxZ = Math.ceil(Math.max(emotionBBox.maxZ, emotionXY[i][2]));
      }
      const scaleY = (faceBBox.maxY - faceBBox.minY) / (emotionBBox.maxY - emotionBBox.minY);
      const scaleX = (faceBBox.maxX - faceBBox.minX) / (emotionBBox.maxX - emotionBBox.minX);
      const scaleZ = (faceBBox.maxZ - faceBBox.minZ) / (emotionBBox.maxZ - emotionBBox.minZ);
      const offsetX = faceBBox.minX - emotionBBox.minX * scaleX;
      const offsetY = faceBBox.minY - emotionBBox.minY * scaleY;
      const offsetZ = faceBBox.minZ - emotionBBox.minZ * scaleZ;

      for (let i = 0; i < 468; i++) {
        emotionXY[i] = [emotionXY[i][0] * scaleX + offsetX, emotionXY[i][1] * scaleY + offsetY, emotionXY[i][2] * scaleZ + offsetZ];
      }

      nextTSP = new TPS(emotionXY, faceXY);
      
      // Pre-compute new transformation map synchronously
      nextTransformationMap = precomputeTransformationMaps(nextTSP);
      
      if (!isAnimating) {
        startNextAnimation();
      }
    }

    const animate = () => {
      const currentTime = performance.now();
      timeDelta += (currentTime - lastTime) / targetTime;
      timeDelta = Math.min(1, timeDelta);
      lastTime = currentTime;
      draw(timeDelta);
      if (timeDelta < 1) {
        requestAnimationFrame(animate);
      }
      else {
        startNextAnimation();
      }
    }
    


    // Pre-allocate buffers
    const buffer1 = new Uint8ClampedArray(700 * 467 * 4);
    const buffer2 = new Uint8ClampedArray(700 * 467 * 4);
    let currentBuffer = buffer1;
    let nextBuffer = buffer2;

    const draw = (interpolation: number) => {
      if (!ctx || !canvasRef) return;
      
      nextBuffer.set(maskedBGData);
      
      // Create error diffusion arrays for each row
      const errorRows = new Array(monkeyBBox.maxY - monkeyBBox.minY + 2);
      for (let i = 0; i < errorRows.length; i++) {
        errorRows[i] = new Array(monkeyBBox.maxX - monkeyBBox.minX + 2).fill(0);
      }
      
      for (let y = monkeyBBox.minY; y < monkeyBBox.maxY; y++) {
        for (let x = monkeyBBox.minX; x < monkeyBBox.maxX; x++) {
          const index = (y * 700 + x) * 4;
          
          if (maskedBGData[index+3] !== 0) continue;
          
          const key = `${x},${y}`;
          
          // Use pre-computed transformations instead of calculating on every frame
          const previousPoint = previousTransformationMap.get(key) || [x, y, 0];
          const currentPoint = transformationMap.get(key) || [x, y, 0];
          
          // Interpolate between pre-computed points
          const interpolatedX = currentPoint[0] * interpolation + previousPoint[0] * (1 - interpolation);
          const interpolatedY = currentPoint[1] * interpolation + previousPoint[1] * (1 - interpolation);
          
          const index2 = (Math.round(interpolatedY) * 700 + Math.round(interpolatedX)) * 4;
          
          // Also pre-compute the forward transformation for the source pixel
          const forwardKey = `${Math.round(interpolatedX)},${Math.round(interpolatedY)}`;
          const sourcePoint = transformationMap.get(forwardKey) || [interpolatedX, interpolatedY, 0];
          const index0 = (Math.round(sourcePoint[1]) * 700 + Math.round(sourcePoint[0])) * 4;
          
          if (nextBuffer[index+3] == 0) {
            // Get source color and add accumulated error
            const sourceColor = (imageData[index0] + imageData[index0+1] + imageData[index0+2]) / 3;
            const errorIndexY = y - monkeyBBox.minY + 1;
            const errorIndexX = x - monkeyBBox.minX + 1;
            const colorWithError = sourceColor + errorRows[errorIndexY][errorIndexX];
            
            // Apply dithering
            const dither = Math.round(colorWithError / 255) * 255;
            const error = Math.min(64, Math.max(0, colorWithError - dither));

            
            
            for (const [dx, dy, weight] of errorDistribution) {
              const newY = errorIndexY + dy;
              const newX = errorIndexX + dx;
              if (newY >= 0 && newY < errorRows.length && newX >= 0 && newX < errorRows[0].length) {
                errorRows[newY][newX] += error * weight;
              }
            }
            
            nextBuffer[index] = 255 - dither;
            nextBuffer[index+1] = 255 - dither;
            nextBuffer[index+2] = 255 - dither;
            nextBuffer[index+3] = 255;
          }
          else {
            // Apply dithering to the background pixels too
            const sourceColor = (imageData[index] + imageData[index+1] + imageData[index+2]) / 3;
            const errorIndexY = y - monkeyBBox.minY + 1;
            const errorIndexX = x - monkeyBBox.minX + 1;
            const colorWithError = sourceColor + errorRows[errorIndexY][errorIndexX];
            
            const threshold = (BAYER_MATRIX[y % 4][x % 4] / 16) * 255;
            const dither = colorWithError > threshold ? 255 : 0;
            const error = Math.min(16, Math.max(-16, colorWithError - dither));
            
            for (const [dx, dy, weight] of errorDistribution) {
              const newY = errorIndexY + dy;
              const newX = errorIndexX + dx;
              if (newY >= 0 && newY < errorRows.length && newX >= 0 && newX < errorRows[0].length) {
                errorRows[newY][newX] += error * weight;
              }
            }
            
            nextBuffer[index2] = 255 - dither;
            nextBuffer[index2+1] = 255 - dither;
            nextBuffer[index2+2] = 255 - dither;
            nextBuffer[index2+3] = 255;
          }
        }
      }
      
      [currentBuffer, nextBuffer] = [nextBuffer, currentBuffer];
      ctx.putImageData(new ImageData(currentBuffer, 700, 467), 0, 0);
    }

    
    // Initialize canvas when component mounts
    createEffect(() => {
      if (canvasRef) {
        canvasRef.width = 700;
        canvasRef.height = 467;
        ctx = canvasRef.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const image = new Image();
          image.src = "./src/data/monkey_eyes.jpeg";
          image.onload = () => {
            ctx.drawImage(image, 0, 0);
            imageData = ctx.getImageData(0, 0, 700, 467).data;
            const bgImageData = new Uint8ClampedArray(700 * 467 * 4).fill(0);
            for (let y = 0; y < 467; y++) {
              for (let x = 0; x < 700; x++) {
                const index = (y * 700 + x) * 4;
                if (!isPointInConvexHull([x, y], monkeyConvexHull)) {
                  const color = (imageData[index] + imageData[index+1] + imageData[index+2]) / 3 > 78 ? 0 : 255;
                  bgImageData[index] = color;
                  bgImageData[index+1] = color;
                  bgImageData[index+2] = color;
                  bgImageData[index+3] = 255;
                }
                else {
                  bgImageData[index] = 255;
                  bgImageData[index+1] = 255;
                  bgImageData[index+2] = 255;
                  bgImageData[index+3] = 0;
                }
              }
            }
            maskedBGData = bgImageData;
          }
        }
      }
    });

    // Use createEffect to react to emotionLevels changes
    createEffect(() => {
      const emotionLevels = {...NoEmotion, ...props.emotionLevels};
      getEmotionTSP(emotionLevels);
    });

    // Pre-compute transformation maps once
    // const precomputeTransformationMaps = () => {
    //   const map = new Map();
    //   for (let y = monkeyBBox.minY; y < monkeyBBox.maxY; y++) {
    //     for (let x = monkeyBBox.minX; x < monkeyBBox.maxX; x++) {
    //       const key = `${x},${y}`;
    //       const transform = mean2monkey.forward(emotion2face.inverse(mean2monkey.inverse([x, y, 0])));
    //       map.set(key, transform);
    //     }
    //   }
    //   return map;
    // };

    return (
      <div style={{display: "flex", "flex-direction": "row", "align-items": "center", "justify-content": "center", "width": "100%", "height": "100%"}}>
        <div style={{width: 460 + "px", height: 460 + "px", position: "relative", "overflow": "hidden", "border": "10px solid lightblue"}}>
          <canvas ref={canvasRef} onclick={() => getEmotionTSP(randomExpression())} style={{position: 'absolute', left: '50%',
      transform: 'translate(calc(-50% + 50px), -50%) scale(1)',
      top: '50%'}}></canvas>
          {/* <div class="halftone"></div> */}
        </div>
          <div style={{display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", "width": "300px" }}>
            <h1>Monkey Feels</h1>
            <div id="controls">
                <h4>Expression</h4>
                <Face id="face" width={140} height={140} expressionModel={new ExpressionModel(props.emotionModel)} emotionLevels={currentEmotionLevels()}/>
                <For each={Object.keys(NoEmotion)}>
                    {(key) => 
                        <div style={{display: "flex", "align-items": "center", gap: "10px"}}>
                            <input type="range" min="-100" max="100" value={emotionLevels[key as keyof EmotionLevels]} oninput={(e) => {
                                emotionLevels[key as keyof EmotionLevels] = parseInt(e.target.value);
                                getEmotionTSP(emotionLevels);
                            }}/>
                            <span>{String(key)}</span>
                        </div>
                    }
                </For>
            </div>
          </div>
        </div>
    );
  };
  
export default ImageTSP;
  

import { Component, createEffect, createSignal, JSXElement } from "solid-js";
import features from "../../data/features.json";
import layers from "../../data/layers.json";
import mediapipe from "../../data/mediapipe478.json";
import meanFace from "../../data/mean.json";
import Face from "../mesh/Face";

const padding = 0;

interface Point {
  x: number;
  y: number;
  index?: number;
}

interface ControlRenderProps {
  featureName: string;
  currentFeature: number;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
  onProcess: () => void;
  children?: any;
}

interface PareidoliaCoreProps {
  // Control system configuration
  controls: {
    render: (props: ControlRenderProps) => JSXElement;
  };
  
  // TPS configuration
  tpsConfig: {
    create: (landmarks: Map<number, number[]>, ...args: any[]) => any;
    update: (tps: any, data: any) => void;
    destroy: (tps: any) => void;
  };
  
  // Optional callbacks
  onFeatureComplete?: (feature: string, points: Point[]) => void;
  onImageProcessed?: (imageData: ImageData) => void;
}

const PareidoliaCore: Component<PareidoliaCoreProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let ctx: CanvasRenderingContext2D | undefined;
  let svgRef: SVGSVGElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let faceRef: typeof Face | undefined;
  let faceSvgRef: SVGSVGElement | undefined;

  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [imageDimensions, setImageDimensions] = createSignal({ width: 600, height: 600 });
  const [displayScale, setDisplayScale] = createSignal(1);
  const [featureName, setFeatureName] = createSignal("Upload an Image");
  
  const fixedPoints: Record<string, Point[]> = {};
  let currentFeature = 0;
  let originalImageData: ImageData | undefined;
  let currentTPS: any = null;

  let editingMode = "feature";
  let currentLayer = "basics";

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

  const calculateDisplayScale = (imageWidth: number, imageHeight: number) => {
    const screenHeight = window.innerHeight;
    const targetHeight = screenHeight * 0.8; // 80% of screen height
    return Math.min(targetHeight / imageHeight, 1); // Don't scale up, only down
  };

  let clearSVG = () => {};

  const fixFeature = () => {
    clearSVG();
    const featureName = Object.keys(features)[currentFeature];
    setFeatureName(featureName);
  }

  const fixImage = async () => {
    clearSVG();
    if (currentTPS) {
      props.tpsConfig.destroy(currentTPS);
      currentTPS = null;
    }

    const imageLandmarks = new Map();
    for (const featureName in fixedPoints) {
      if (features[featureName].path.length == 0 || fixedPoints[featureName].length == 0) {
        continue;
      }
      if (features[featureName].path.length == 1) {
        imageLandmarks.set(features[featureName].path[0], [fixedPoints[featureName][0].x, fixedPoints[featureName][0].y, 0]);
      }
      else if (features[featureName].path.length == 2) {
        imageLandmarks.set(features[featureName].path[0], [fixedPoints[featureName][0].x, fixedPoints[featureName][0].y, 0]);
        imageLandmarks.set(features[featureName].path[1], [fixedPoints[featureName][1].x, fixedPoints[featureName][1].y, 0]);
      }
      else {
        // Handle complex paths - simplified for now
        for (let i = 0; i < features[featureName].path.length; i++) {
          if (fixedPoints[featureName][i]) {
            imageLandmarks.set(features[featureName].path[i], [fixedPoints[featureName][i].x, fixedPoints[featureName][i].y, 0]);
          }
        }
      }
    }
    
    // Create TPS using the provided configuration
    currentTPS = props.tpsConfig.create(imageLandmarks, originalImageData);
    
    if (props.onImageProcessed) {
      props.onImageProcessed(originalImageData);
    }
  }

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
        const maxSize = 640;
        const downsize = Math.min(1, maxSize / img.width, maxSize / img.height);
        const newWidth = img.width * downsize;
        const newHeight = img.height * downsize;
        setImageDimensions({ width: newWidth, height: newHeight });
        
        // Calculate display scale
        const scale = calculateDisplayScale(newWidth, newHeight);
        setDisplayScale(scale);
        
        // Resize canvas
        if (canvasRef) {
          canvasRef.width = newWidth;
          canvasRef.height = newHeight;
          ctx = canvasRef.getContext("2d");
          ctx?.drawImage(img, 0, 0, newWidth, newHeight);
        }
        
        // Resize SVG
        if (svgRef) {
          svgRef.setAttribute('width', newWidth.toString());
          svgRef.setAttribute('height', newHeight.toString());
        }
        
        originalImageData = ctx?.getImageData(0, 0, newWidth, newHeight);
        setImageLoaded(true);
        normalizedLandmarks = normalizeLandmarks(mediapipe.vertices);
        fixFeature();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  createEffect(() => {
    if (!canvasRef || !svgRef) return;
    ctx = canvasRef.getContext("2d");
    
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
      
      if (props.onFeatureComplete) {
        props.onFeatureComplete(featureName, fixedPoints[featureName]);
      }
      
      currentFeature++;
      currentFeature = Math.min(currentFeature, Object.keys(features).length);
      if (currentLayer == "basics" && currentFeature > 2) {
        currentLayer = "silhouette";
      }
      fixFeature();
      clearSVG();
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
            'pointer-events': imageLoaded() ? 'auto' : 'none',
            "stroke-width": `${5/displayScale()}px`,
            "stroke": "blue",
            "fill": "rgba(255,255,255,0.4)",
            filter: "invert(1)"
          }}
        ></svg>
      </div>
      
      {props.controls.render({
        featureName: featureName(),
        currentFeature,
        onBack: () => {
          currentFeature = Math.max(0, currentFeature - 1);
          fixFeature();
        },
        onSkip: () => {
          fixedPoints[featureName()] = [];
          currentFeature++;
          if (currentFeature >= Object.keys(features).length) {
            currentFeature = 0;
          }
          fixFeature();
        },
        onNext: () => {
          currentFeature++;
          if (currentFeature >= Object.keys(features).length) {
            currentFeature = 0;
          }
          fixFeature();
        },
        onProcess: () => {
          fixImage();
        }
      })}
    </div>
  );
}

export default PareidoliaCore; 
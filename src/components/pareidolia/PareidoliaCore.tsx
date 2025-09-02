import { Component, createEffect, createSignal, JSXElement } from "solid-js";
import features from "../../data/features.json";
import layers from "../../data/layers.json";
import mediapipe from "../../data/mediapipe478.json";
import meanFace from "../../data/mean.json";
import Face from "../threejs/Face";
import TPS from "../../lib/tps/TPS";
import EmotionModel, { NoEmotion, EmotionLevels } from "../../lib/EmotionModel";
import ExpressionModel from "~/lib/threejs/ExpressionModel";
import { Show, For } from "solid-js";

const padding = 0;

interface Point {
  x: number;
  y: number;
  index?: number;
}

interface ControlRenderProps {
  children?: any;
}

interface PareidoliaCoreProps {
  emotions?: {
    model: EmotionModel;
    callback: (emotionLevels: EmotionLevels) => void;
  };

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

  setOriginalImageData: (imageData: ImageData) => void;
}

const PareidoliaCore: Component<PareidoliaCoreProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let ctx: CanvasRenderingContext2D | undefined;
  let svgRef: SVGSVGElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let faceRef: typeof Face | undefined;
  let faceSvgRef: SVGSVGElement | undefined;
  const { setOriginalImageData } = props;

  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [imageDimensions, setImageDimensions] = createSignal({
    width: 600,
    height: 600,
  });
  const [displayScale, setDisplayScale] = createSignal(1);
  const [featureName, setFeatureName] = createSignal("Upload an Image");

  const fixedPoints: any = { points: [] };
  let currentFeature = 0;
  let originalImageData: ImageData | undefined;
  let currentTPS: any = null;

  let editingMode = "feature";
  const [currentLayer, setCurrentLayer] = createSignal("basics");

  const normalizeLandmarks = (landmarks: number[]) => {
    const currentWidth = imageDimensions().width;
    const currentHeight = imageDimensions().height;
    const xCoords = landmarks.filter((d, i) => i % 3 === 0);
    const yCoords = landmarks.filter((d, i) => i % 3 === 1);
    const minX = Math.min(...xCoords);
    const minY = Math.min(...yCoords);
    const maxX = Math.max(...xCoords);
    const maxY = Math.max(...yCoords);
    const scaleX = (currentWidth - 2 * padding) / (maxX - minX);
    const scaleY = (currentHeight - 2 * padding) / (maxY - minY);
    const normalizedLandmarks = landmarks.map((l, i) => {
      if (i % 3 === 0) return (l - minX) * scaleX + padding;
      if (i % 3 === 1) return currentHeight - ((l - minY) * scaleY + padding);
      return l; // z-coordinate
    });
    return normalizedLandmarks;
  };

  let normalizedLandmarks = normalizeLandmarks(mediapipe.vertices);

  const calculateDisplayScale = (imageWidth: number, imageHeight: number) => {
    const maxSize = 640;
    const scale = Math.min(maxSize / imageHeight, maxSize / imageWidth);
    console.log("scale", scale, maxSize, imageHeight, imageWidth);
    return scale;
  };

  let clearSVG = () => {};

  let displayPoints: number[][] = [];
  let isThinking = false;
  const TARGET_FPS = 60; // Limit to 30 FPS
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  let lastFrameTime = 0;

  let registrationTPS: TPS | null = null;

  const fixFeature = () => {
    // clearSVG();
    // const featureName = Object.keys(features)[currentFeature];
    // setFeatureName(featureName);
    const registrationPoints = [];
    const registrationLandmarks = [];
    if (editingMode == "feature") {
      instructionStart = performance.now();
      for (const featureName in fixedPoints) {
        let index = 0;
        for (const point of fixedPoints[featureName]) {
          if (!point) {
            index++;
            continue;
          }
          // if (featureName == "points") {
          //     registrationPoints.push([point.x, point.y, 0]);
          //     registrationLandmarks.push([mediapipe.vertices[point.index * 3], mediapipe.vertices[point.index * 3 + 1], mediapipe.vertices[point.index * 3 + 2]]);
          // }
          if (featureName != "points") {
            fixedPoints["points"][features[featureName].path[index]] = {
              x: point.x,
              y: point.y,
              index: features[featureName].path[index],
            };
            //registrationLandmarks.push([mediapipe.vertices[features[featureName].path[index] * 3], mediapipe.vertices[features[featureName].path[index] * 3 + 1], mediapipe.vertices[features[featureName].path[index] * 3 + 2]]);
          }
          index++;
        }
      }
    }
    for (const point of fixedPoints["points"]) {
      if (!point) continue;
      registrationPoints.push([point.x, point.y, 0]);
      registrationLandmarks.push([
        mediapipe.vertices[point.index * 3],
        mediapipe.vertices[point.index * 3 + 1],
        mediapipe.vertices[point.index * 3 + 2],
      ]);
    }
    // console.log(registrationPoints);
    // console.log(registrationLandmarks);
    // console.log(fixedPoints);
    if (registrationPoints.length > 5 && !isThinking) {
      editingMode = "points";
      isThinking = true;
      requestAnimationFrame(() => {
        registrationTPS = new TPS(registrationPoints, registrationLandmarks);
        displayPoints = [];
        for (var i = 0; i < mediapipe.vertices.length; i += 3) {
          const vertex = [
            mediapipe.vertices[i],
            mediapipe.vertices[i + 1],
            mediapipe.vertices[i + 2],
          ];
          // console.log(vertex);
          displayPoints.push(registrationTPS.inverse(vertex));
        }
        drawLandmarks();
        isThinking = false;
      });
    } else {
      clearSVG();
    }
    const featureName = Object.keys(features)[currentFeature];
    setFeatureName(featureName);

    // drawLandmarks();
  };

  const fixImage = async () => {
    clearSVG();
    if (currentTPS) {
      currentTPS.getCanvas().remove();
      props.tpsConfig.destroy(currentTPS);
      currentTPS = null;
    }

    const imageLandmarks = new Map();
    // for (const featureName in fixedPoints) {
    //   if (features[featureName].path.length == 0 || fixedPoints[featureName].length == 0) {
    //     continue;
    //   }
    //   if (features[featureName].path.length == 1) {
    //     imageLandmarks.set(features[featureName].path[0], [fixedPoints[featureName][0].x, fixedPoints[featureName][0].y, 0]);
    //   }
    //   else if (features[featureName].path.length == 2) {
    //     imageLandmarks.set(features[featureName].path[0], [fixedPoints[featureName][0].x, fixedPoints[featureName][0].y, 0]);
    //     imageLandmarks.set(features[featureName].path[1], [fixedPoints[featureName][1].x, fixedPoints[featureName][1].y, 0]);
    //   }
    //   else {
    //     // Handle complex paths - simplified for now
    //     for (let i = 0; i < features[featureName].path.length; i++) {
    //       if (fixedPoints[featureName][i]) {
    //         imageLandmarks.set(features[featureName].path[i], [fixedPoints[featureName][i].x, fixedPoints[featureName][i].y, 0]);
    //       }
    //     }
    //   }
    for (const point of fixedPoints["points"]) {
      if (!point) continue;
      imageLandmarks.set(point.index, [point.x, point.y, 0]);
    }

    // Create TPS using the provided configuration
    console.log("imageLandmarks", imageLandmarks, originalImageData);
    currentTPS = props.tpsConfig.create(imageLandmarks, originalImageData);
    svgRef.after(currentTPS.getCanvas());

    setOriginalImageData(originalImageData);
  };

  const maxMeanX = Math.max(...meanFace.filter((d, i) => i % 3 === 0));
  const minMeanX = Math.min(...meanFace.filter((d, i) => i % 3 === 0));
  const maxMeanY = Math.max(...meanFace.filter((d, i) => i % 3 === 1));
  const minMeanY = Math.min(...meanFace.filter((d, i) => i % 3 === 1));

  const imageSize = 140;

  const scaleFaceLandmark = (index: number) => {
    const meanPoint = meanFace.slice(index * 3, index * 3 + 3);
    const result = [];
    result.push(((meanPoint[0] - minMeanX) / (maxMeanX - minMeanX)) * 96 + 22); // face padding left: 22, right: 22
    result.push(((meanPoint[1] - minMeanY) / (maxMeanY - minMeanY)) * 112 + 12); // face padding top: 12, bottom: 16
    return result;
  };

  const instructionLine = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "line"
  );
  instructionLine.style.stroke = "cyan";
  instructionLine.style.fill = "none";
  instructionLine.style.strokeWidth = "3";
  let instructionStart = performance.now();
  const animateInstruction = () => {
    console.log("animateInstruction", faceSvgRef);
    if (!faceSvgRef) return;
    if (currentFeature >= 3) {
      faceSvgRef.innerHTML = "";
      return;
    }
    let feature = Object.keys(features)[currentFeature];
    console.log(currentFeature, feature, Object.keys(features));
    const p1 = scaleFaceLandmark(features[feature].path[0]);
    const p2 = scaleFaceLandmark(features[feature].path[1]);
    const t = (performance.now() - instructionStart) % (1000 * Math.PI);
    const interp = 0.5 * (1 + Math.cos(t / 1000));
    const p = [
      p1[0] * interp + p2[0] * (1 - interp),
      p1[1] * interp + p2[1] * (1 - interp),
    ];
    instructionLine.setAttribute("x1", p1[0].toString());
    instructionLine.setAttribute("y1", p1[1].toString());
    instructionLine.setAttribute("x2", p[0].toString());
    instructionLine.setAttribute("y2", p[1].toString());
    faceSvgRef.appendChild(instructionLine);
    requestAnimationFrame(animateInstruction);
  };

  const activateFacePoint = (point: SVGCircleElement) => {
    if (!faceSvgRef) return;
    const activeIndex = parseInt(point.getAttribute("index")!);
    const faceLandmark = scaleFaceLandmark(activeIndex);
    console.log(faceLandmark);
    const faceLandmarkElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    faceLandmarkElement.setAttribute("cx", faceLandmark[0].toString());
    faceLandmarkElement.setAttribute("cy", faceLandmark[1].toString());
    faceLandmarkElement.setAttribute("r", "2");
    faceLandmarkElement.style.stroke = "black";
    faceLandmarkElement.style.fill = "white";
    faceSvgRef.appendChild(faceLandmarkElement);
  };

  const deactivateFacePoint = () => {
    if (faceSvgRef) {
      faceSvgRef.innerHTML = "";
    }
  };

  let activePoint: SVGCircleElement | null = null;
  const addPointMovementHandlers = (circleElement: SVGCircleElement) => {
    circleElement.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      activePoint = circleElement;
      activateFacePoint(circleElement);
    };
    circleElement.onmouseenter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // activePoint = circleElement;
      activateFacePoint(circleElement);
    };
    circleElement.onmouseleave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // activePoint = circleElement;
      deactivateFacePoint();
    };
  };

  const drawLandmarks = (clear: boolean = false) => {
    if (!svgRef) return;

    // Clear existing landmarks
    if (clear) {
      clearSVG();
    }

    // for (const feature in features) {
    //     const landmarks = features[feature].path;
    //     const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    //     pathElement.setAttribute("d", `M ${landmarks.map((l, i) => normalizedLandmarks.slice(l*3, l*3+2).join(" ")).join(" ")}`);
    //     svgRef.appendChild(pathElement);

    //     for (const landmark of landmarks) {
    //         const point = normalizedLandmarks.slice(landmark*3, landmark*3+3);
    //         const circleElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    //         circleElement.setAttribute("cx", point[0].toString());
    //         circleElement.setAttribute("cy", point[1].toString());
    //         circleElement.setAttribute("r", (2/displayScale()).toString());
    //         circleElement.style.stroke = "red";
    //         circleElement.style.fill = "red";
    //         svgRef.appendChild(circleElement);
    //     }
    // }

    const layerPoints = [];
    for (const featureName in layers[currentLayer()]) {
      layerPoints.push(...layers[currentLayer()][featureName].path);
    }

    console.log(layerPoints);

    for (var i = 0; i < displayPoints.length; i++) {
      if (!layerPoints.includes(i)) {
        continue;
      }
      const point = displayPoints[i];
      const pointElement = document.getElementById("point-" + i);
      if (pointElement) {
        if (i in fixedPoints["points"]) {
          pointElement.setAttribute("r", (2 / displayScale()).toString());
          pointElement.style.stroke = "blue";
          pointElement.style.fill = "blue";
        }
        pointElement.setAttribute("cx", point[0].toString());
        pointElement.setAttribute("cy", point[1].toString());
      } else {
        const circleElement = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        circleElement.setAttribute("cx", point[0].toString());
        circleElement.setAttribute("cy", point[1].toString());
        circleElement.setAttribute("id", "point-" + i);
        circleElement.setAttribute("index", i.toString());
        circleElement.style.stroke = "red";
        circleElement.style.fill = "red";
        circleElement.setAttribute("r", (0.5 / displayScale()).toString());
        if (i in fixedPoints["points"]) {
          circleElement.setAttribute("r", (2 / displayScale()).toString());
          circleElement.style.stroke = "blue";
          circleElement.style.fill = "blue";
          circleElement.style.strokeWidth = "1";
        }
        addPointMovementHandlers(circleElement);
        svgRef.appendChild(circleElement);
      }
    }
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
    if (!file.type.startsWith("image/")) {
      alert("Please drop an image file");
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
          svgRef.setAttribute("width", newWidth.toString());
          svgRef.setAttribute("height", newHeight.toString());
        }

        originalImageData = ctx?.getImageData(0, 0, newWidth, newHeight);
        setImageLoaded(true);
        normalizedLandmarks = normalizeLandmarks(mediapipe.vertices);
        fixFeature();
        animateInstruction();
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
    let startPoint = { x: 0, y: 0 };

    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("cx", startPoint.x.toString());
    circle.setAttribute("cy", startPoint.y.toString());
    circle.setAttribute("r", (5 / displayScale()).toString());
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
    path.setAttribute(
      "d",
      `M ${startPoint.x} ${startPoint.y} L ${startPoint.x} ${startPoint.y}`
    );
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
    };

    svgRef.onmousedown = (e) => {
      //     if (currentFeature == null) return;
      //     const featureName = Object.keys(features)[currentFeature];
      //     e.preventDefault();
      //     e.stopPropagation();

      //     const { x, y } = getSVGPoint(e);
      //     isDrawing = true;
      //     startPoint = { x, y };
      //     fixedPoints[featureName] = [];
      //     if (features[featureName].path.length == 1) {
      //       circle.setAttribute("cx", x.toString());
      //       circle.setAttribute("cy", y.toString());
      //       svgRef.appendChild(circle);
      //     } else if (features[featureName].path.length == 2) {
      //       fixedPoints[featureName].push(startPoint);
      //       line.setAttribute("x1", startPoint.x.toString());
      //       line.setAttribute("y1", startPoint.y.toString());
      //       line.setAttribute("x2", startPoint.x.toString());
      //       line.setAttribute("y2", startPoint.y.toString());
      //       svgRef.appendChild(line);
      //     } else {
      //       fixedPoints[featureName].push(startPoint);
      //       path.setAttribute(
      //         "d",
      //         "M " +
      //           fixedPoints[featureName].map((p, i) => `${p.x} ${p.y}`).join(" L ")
      //       );
      //       svgRef.appendChild(path);
      //     }
      //   };

      //   svgRef.onmousemove = (e) => {
      //     if (currentFeature == null) return;
      //     const featureName = Object.keys(features)[currentFeature];
      //     e.preventDefault();
      //     e.stopPropagation();
      //     if (isDrawing) {
      //       const { x, y } = getSVGPoint(e);
      //       if (features[featureName].path.length == 1) {
      //         circle.setAttribute("cx", x.toString());
      //         circle.setAttribute("cy", y.toString());
      //       } else if (features[featureName].path.length == 2) {
      //         line.setAttribute("x2", x.toString());
      //         line.setAttribute("y2", y.toString());
      //       } else {
      //         fixedPoints[featureName].push({ x, y });
      //         path.setAttribute(
      //           "d",
      //           "M " +
      //             fixedPoints[featureName]
      //               .map((p, i) => `${p.x} ${p.y}`)
      //               .join(" L ")
      //         );
      //       }
      //     }
      //   };

      //   svgRef.onmouseup = (e) => {
      //     if (currentFeature == null) return;
      //     const featureName = Object.keys(features)[currentFeature];
      //     e.preventDefault();
      //     e.stopPropagation();
      //     isDrawing = false;
      //     const { x, y } = getSVGPoint(e);
      //     if (features[featureName].path.length == 1) {
      //       fixedPoints[featureName].push(startPoint);
      //     } else if (features[featureName].path.length == 2) {
      //       fixedPoints[featureName].push({ x, y });
      //     } else {
      //       fixedPoints[featureName].push({ x, y });
      //       fixedPoints[featureName].push({ x: startPoint.x, y: startPoint.y });
      //       path.setAttribute(
      //         "d",
      //         "M " +
      //           fixedPoints[featureName].map((p, i) => `${p.x} ${p.y}`).join(" L ")
      //       );
      //     }

      //     if (props.onFeatureComplete) {
      //       props.onFeatureComplete(featureName, fixedPoints[featureName]);
      //     }

      //     currentFeature++;
      //     currentFeature = Math.min(currentFeature, Object.keys(features).length);
      //     if (currentLayer == "basics" && currentFeature > 2) {
      //       currentLayer = "silhouette";
      //     }
      //     fixFeature();
      //     clearSVG();
      //   };
      // });
      if (currentFeature == null) return;
      if (activePoint || editingMode == "points") return;
      const featureName = Object.keys(features)[currentFeature];
      e.preventDefault();
      e.stopPropagation();

      const { x, y } = getSVGPoint(e);
      isDrawing = true;
      startPoint = { x, y };
      fixedPoints[featureName] = [];
      if (features[featureName].path.length == 1) {
        circle.setAttribute("cx", x.toString());
        circle.setAttribute("cy", y.toString());
        svgRef.appendChild(circle);
      } else if (features[featureName].path.length == 2) {
        fixedPoints[featureName].push(startPoint);
        line.setAttribute("x1", startPoint.x.toString());
        line.setAttribute("y1", startPoint.y.toString());
        line.setAttribute("x2", startPoint.x.toString());
        line.setAttribute("y2", startPoint.y.toString());
        svgRef.appendChild(line);
      } else {
        fixedPoints[featureName].push(startPoint);
        path.setAttribute(
          "d",
          "M " +
            fixedPoints[featureName].map((p, i) => `${p.x} ${p.y}`).join(" L ")
        );
        svgRef.appendChild(path);
      }
    };

    svgRef.onmousemove = (e) => {
      if (currentFeature == null) return;
      if (activePoint) {
        e.preventDefault();
        e.stopPropagation();
        const rect = svgRef!.getBoundingClientRect();
        const x = (e.clientX - rect.left) / displayScale();
        const y = (e.clientY - rect.top) / displayScale();
        activePoint.setAttribute("cx", x.toString());
        activePoint.setAttribute("cy", y.toString());
        const index = parseInt(activePoint.getAttribute("index")!);
        fixedPoints["points"][index] = {
          x,
          y,
          index: parseInt(activePoint.getAttribute("index")!),
        };
        fixFeature();

        return;
      }
      if (editingMode == "points") return;
      const featureName = Object.keys(features)[currentFeature];
      e.preventDefault();
      e.stopPropagation();
      if (isDrawing) {
        const { x, y } = getSVGPoint(e);
        if (features[featureName].path.length == 1) {
          circle.setAttribute("cx", x.toString());
          circle.setAttribute("cy", y.toString());
        } else if (features[featureName].path.length == 2) {
          line.setAttribute("x2", x.toString());
          line.setAttribute("y2", y.toString());
        } else {
          fixedPoints[featureName].push({ x, y });
          path.setAttribute(
            "d",
            "M " +
              fixedPoints[featureName]
                .map((p, i) => `${p.x} ${p.y}`)
                .join(" L ")
          );
        }
      }
    };

    svgRef.onmouseup = (e) => {
      if (currentFeature == null) return;
      if (activePoint || editingMode == "points") {
        e.preventDefault();
        e.stopPropagation();
        activePoint = null;
        deactivateFacePoint();
        return;
      }
      const featureName = Object.keys(features)[currentFeature];
      e.preventDefault();
      e.stopPropagation();
      isDrawing = false;
      const { x, y } = getSVGPoint(e);
      if (features[featureName].path.length == 1) {
        fixedPoints[featureName].push(startPoint);
      } else if (features[featureName].path.length == 2) {
        fixedPoints[featureName].push({ x, y });
      } else {
        fixedPoints[featureName].push({ x, y });
        fixedPoints[featureName].push({ x: startPoint.x, y: startPoint.y });
        path.setAttribute(
          "d",
          "M " +
            fixedPoints[featureName].map((p, i) => `${p.x} ${p.y}`).join(" L ")
        );
      }
      currentFeature++;
      currentFeature = Math.min(currentFeature, Object.keys(features).length);
      if (currentLayer() == "basics" && currentFeature > 2) {
        setCurrentLayer("silhouette");
      }
      fixFeature();
      clearSVG();
    };
  });

  const [displayEmotionLevels, setDisplayEmotionLevels] = createSignal<EmotionLevels>(NoEmotion);

  return (
    <div
      id="pareidolia"
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        position: "relative",
        display: "flex",
        "flex-direction": "row",
        "align-items": "center",
        "justify-content": "center",
        border: "2px dashed #ccc",
        padding: "10px",
        width: "100vw",
        height: "100vh",
        background: "rgba(255,0,0,.1)",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "justify-content": "center",
          transform: `scale(${displayScale()})`,
          "transform-origin": "center center",
          "flex-grow": 3,
          "flex-shrink": 0,
          width: imageLoaded()
            ? imageDimensions().width * displayScale() + "px"
            : "auto",
          height: imageLoaded()
            ? imageDimensions().height * displayScale() + "px"
            : "auto",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#999",
            "font-size": "16px",
            "pointer-events": "none",
            display: imageLoaded() ? "none" : "block",
            background: "white",
            "z-index": 1000,
          }}
        >
          Drop an image here
        </div>
        <canvas
          id="source"
          ref={canvasRef}
          width={imageDimensions().width}
          height={imageDimensions().height}
          style={{
            display: "block",
            "box-shadow": imageLoaded()
              ? `${-0.5 / displayScale()}em ${
                  0.5 / displayScale()
                }em 0 rgba(0,0,0,.5), ${-1 / displayScale()}em ${
                  1 / displayScale()
                }em 0 gray`
              : "none",
          }}
        ></canvas>
        <div
          id="overlays"
          style={{
            width: imageDimensions().width + "px",
            height: imageDimensions().height + "px",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            "z-index": 1000,
          }}
        >
          <svg
            id="landmarks"
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            width={imageDimensions().width}
            height={imageDimensions().height}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              "pointer-events": imageLoaded() ? "auto" : "none",
              "stroke-width": `${5 / displayScale()}px`,
              stroke: "blue",
              fill: "rgba(255,255,255,0.4)",
              filter: "invert(1)",
            }}
          ></svg>
        </div>
      </div>

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
            <Face id="face" ref={faceRef} width={140} height={140} expressionModel={props.emotions ? new ExpressionModel(props.emotions.model) : undefined} emotionLevels={displayEmotionLevels}/>
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
          <Show when={ props.emotions } >
            <For each={Object.keys(NoEmotion)}>
                    {(key) => 
                        <div id="emotion-sliders" style={{display: "flex", "align-items": "center", gap: "10px"}}>
                            <input type="range" min="-100" max="100" value={displayEmotionLevels()[key as keyof EmotionLevels]} oninput={(e) => {
                                const currentEmotions = displayEmotionLevels();
                                const newEmotions = {...currentEmotions, [key]: parseInt(e.target.value)};
                                setDisplayEmotionLevels(newEmotions);
                                props.emotions.callback(newEmotions);
                            }}/>
                            <span>{String(key)}</span>
                        </div>
                    }
                </For>
                <input type="button" value="Reset" onClick={() => {
                    setDisplayEmotionLevels(NoEmotion);
                    document.querySelectorAll("#emotion-sliders input[type='range']").forEach((input) => {
                        (input as HTMLInputElement).value = "0";
                    });
                    props.emotions.callback(NoEmotion);
                }} />
          </Show>
          <h4>Layers</h4>
          <div id="layers">
            <input
              type="button"
              value="Mask"
              onClick={() => setCurrentLayer("mask")}
            />
            {Object.keys(layers).map((layer) => {
              return (
                <input
                  type="button"
                  value={layer}
                  onClick={() => {
                    setCurrentLayer(layer);
                    drawLandmarks(true);
                  }}
                />
              );
            })}
            <input
              type="button"
              value="Basics"
              onClick={() => setCurrentLayer("basics")}
            />
          </div>
          <h4>{featureName()}</h4>
          <div>Drag and drop an image to get started.</div>
          <input
            type="button"
            value="Back"
            onClick={() => {
              currentFeature = Math.max(0, currentFeature - 1);
              fixFeature();
            }}
          />
          <input
            type="button"
            value="Skip"
            onClick={() => {
              fixedPoints[featureName()] = [];
              currentFeature++;
              if (currentFeature >= Object.keys(features).length) {
                currentFeature = 0;
              }
              fixFeature();
            }}
          />
          <input
            type="button"
            value="Next"
            onClick={() => {
              currentFeature++;
              if (currentFeature >= Object.keys(features).length) {
                currentFeature = 0;
              }
              fixFeature();
            }}
          />
          <br />
          <input
            type="button"
            value="Do it!"
            onClick={() => {
              fixImage();
            }}
          />
          <input
            type="button"
            value="View Points"
            onClick={(e) => {
              const button = e.target as HTMLInputElement;
              if (svgRef.children.length > 0) {
                svgRef.innerHTML = "";
                button.value = "View Points";
              } else {
                drawLandmarks();
                button.value = "Hide Points";
              }
            }}
          />
          {props.controls.render({})}
          <br />
        </div>
      </div>
    </div>
  );
};

export default PareidoliaCore;

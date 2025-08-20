import { Component, createSignal } from "solid-js";
import PareidoliaCore from "../../../components/pareidolia/PareidoliaCore";
import Controls from "../../../components/ui/Controls";
import EmotionModel, { NoEmotion } from "../lib/EmotionModel";
import ImageTPS from "../../pareidolia/lib/EmotionTPS";

const Pareidolia: Component<{emotionModel: EmotionModel}> = (props) => {
    const { emotionModel } = props;

  const [currentEmotionLevels, setCurrentEmotionLevels] = createSignal(NoEmotion);
  const [offsetEmotionLevels, setOffsetEmotionLevels] = createSignal(NoEmotion);
  const [isThinking, setIsThinking] = createSignal(false);
  const [imageTPS, setImageTPS] = createSignal<ImageTPS | null>(null);
  const [originalImageData, setOriginalImageData] = createSignal<ImageData | null>(null);

  const handleFeatureComplete = (feature: string, points: any[]) => {
    // Handle feature completion if needed
  };

  const handleImageProcessed = (imageData: ImageData) => {
    setOriginalImageData(imageData);
  };

  const handleEmotionUpdate = async (emotionLevels: any) => {
    if (isThinking() || !imageTPS()) return;
    
    setCurrentEmotionLevels(emotionLevels);
    const adjustedEmotionLevels = {...emotionLevels};
    for (var emotion in offsetEmotionLevels()) {
      adjustedEmotionLevels[emotion] -= offsetEmotionLevels()[emotion];
    }
    
    setIsThinking(true);
    
    try {
      await imageTPS()!.drawGPUWithEmotion(adjustedEmotionLevels, originalImageData()!);
                } catch (error) {
                    console.error('GPU rendering failed, using CPU fallback:', error);
      // CPU fallback implementation
      const canvas = imageTPS()!.getCanvas();
                    const newImageData = new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(0);
      const imageWidth = canvas.width;
                    for (var y = 0; y < canvas.height; y++) {
                        for (var x = 0; x < canvas.width; x++) {
          if (imageTPS()!.getMask()[y * canvas.width + x] == 0) continue;
          const transformed = imageTPS()!.transformXYWithEmotion(adjustedEmotionLevels, x + imageTPS()!.getImageBBox().minX, y + imageTPS()!.getImageBBox().minY);
                            const index = (y * canvas.width + x) * 4;
                            const oldIndex = (Math.round(transformed[1]) * imageWidth + Math.round(transformed[0])) * 4;
          newImageData[index] = originalImageData()!.data[oldIndex];
          newImageData[index + 1] = originalImageData()!.data[oldIndex + 1];
          newImageData[index + 2] = originalImageData()!.data[oldIndex + 2];
          newImageData[index + 3] = originalImageData()!.data[oldIndex + 3];
        }
      }
      imageTPS()!.getCanvas().getContext("2d")?.putImageData(new ImageData(newImageData, canvas.width, canvas.height), 0, 0);
                } finally {
      setIsThinking(false);
    }
  };

  return (
    <PareidoliaCore
      controls={{
        render: (props) => (
          <Controls 
            title="Pareidolia" 
            emotionModel={emotionModel} 
            callback={handleEmotionUpdate}
            {...props}
          >
            <h4>{props.featureName}</h4>
            <div>Drag and drop an image to get started.</div>
            <input type="button" value="Back" onClick={props.onBack} />
            <input type="button" value="Skip" onClick={props.onSkip} />
            <input type="button" value="Next" onClick={props.onNext} />
                <br />
            <input type="button" value="Do it!" onClick={props.onProcess} />
            </Controls>
        )
      }}
      tpsConfig={{
        create: (landmarks, imageData) => {
          const tps = new ImageTPS(landmarks, currentEmotionLevels(), new EmotionModel());
          setImageTPS(tps);
          return tps;
        },
        update: (tps, emotionLevels) => {
          // Handle emotion-based updates
        },
        destroy: (tps) => {
          tps.destroy();
          setImageTPS(null);
        }
      }}
      onFeatureComplete={handleFeatureComplete}
      onImageProcessed={handleImageProcessed}
    />
    );
}

export default Pareidolia;
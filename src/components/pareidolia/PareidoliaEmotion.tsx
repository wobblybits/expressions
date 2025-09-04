import { Component, createSignal } from "solid-js";
import PareidoliaCore from "../pareidolia/PareidoliaCore";
import Controls from "../ui/Controls";
import EmotionModel, { NoEmotion } from "../../lib/EmotionModel";
import EmotionTPS from "../../lib/pareidolia/EmotionTPS";

const Pareidolia: Component<{ emotionModel: EmotionModel }> = (props) => {
  const { emotionModel } = props;

  const [currentEmotionLevels, setCurrentEmotionLevels] =
    createSignal(NoEmotion);
  const [offsetEmotionLevels, setOffsetEmotionLevels] = createSignal(NoEmotion);
  const [isThinking, setIsThinking] = createSignal(false);
  const [emotionTPS, setEmotionTPS] = createSignal<EmotionTPS | null>(null);
  const [originalImageData, setOriginalImageData] =
    createSignal<ImageData | null>(null);

  const handleEmotionUpdate = async (emotionLevels: any) => {
    if (isThinking() || !emotionTPS()) return;

    // if(!emotionTPS() || !emotionTPS()!.updateActiveTargets(emotionLevels)) return;

    setCurrentEmotionLevels(emotionLevels);
    const adjustedEmotionLevels = { ...emotionLevels };
    for (var emotion in offsetEmotionLevels()) {
      adjustedEmotionLevels[emotion] -= offsetEmotionLevels()[emotion];
    }

    setIsThinking(true);

    try {
      await emotionTPS()!.drawGPUWithEmotion(
        adjustedEmotionLevels,
        originalImageData()!
      );
    } catch (error) {
      console.error("GPU rendering failed, using CPU fallback:", error);
      // CPU fallback implementation
      const canvas = emotionTPS()!.getCanvas();
      const newImageData = new Uint8ClampedArray(
        canvas.width * canvas.height * 4
      ).fill(0);
      const imageWidth = canvas.width;
      for (var y = 0; y < canvas.height; y++) {
        for (var x = 0; x < canvas.width; x++) {
          if (emotionTPS()!.getMask()[y * canvas.width + x] == 0) continue;
          const transformed = emotionTPS()!.transformXYWithEmotion(
            adjustedEmotionLevels,
            x + emotionTPS()!.getImageBBox().minX,
            y + emotionTPS()!.getImageBBox().minY
          );
          const index = (y * canvas.width + x) * 4;
          const oldIndex =
            (Math.round(transformed[1]) * imageWidth +
              Math.round(transformed[0])) *
            4;
          newImageData[index] = originalImageData()!.data[oldIndex];
          newImageData[index + 1] = originalImageData()!.data[oldIndex + 1];
          newImageData[index + 2] = originalImageData()!.data[oldIndex + 2];
          newImageData[index + 3] = originalImageData()!.data[oldIndex + 3];
        }
      }
      emotionTPS()!
        .getCanvas()
        .getContext("2d")
        ?.putImageData(
          new ImageData(newImageData, canvas.width, canvas.height),
          0,
          0
        );
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <PareidoliaCore
      emotions={{
        model: emotionModel,
        callback: handleEmotionUpdate,
      }}
      controls={{
        render: (props) => (<></>),
      }}
      tpsConfig={{
        create: (landmarks, imageData, blurMask, imageBBox) => {
          const tps = new EmotionTPS(
            landmarks,
            currentEmotionLevels(),
            new EmotionModel(),
            imageData,
            blurMask,
            imageBBox,
            1
          );
          setEmotionTPS(tps);
          return tps;
        },
        update: (tps, emotionLevels) => {
          // tps.updateActiveTargets(emotionLevels);
          // Handle emotion-based updates
        },
        destroy: (tps) => {
          tps.destroy();
          setEmotionTPS(null);
        },
      }}
      setOriginalImageData={setOriginalImageData}
    />
  );
};

export default Pareidolia;

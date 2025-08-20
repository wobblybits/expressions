import type { Component } from 'solid-js';
import ExpressionModel from '../lib/ExpressionModel';
import EmotionModel from '../lib/EmotionModel';
import Controls from '../../../components/mesh/Controls';
import ClientOnly from '~/lib/ClientOnly';

const SynthPage: Component = () => {
  const emotionModel = new EmotionModel();
  const expressionModel = new ExpressionModel(emotionModel);
  return (
      <div>
        <h1>Synth</h1>
        <p>Explainer text</p>
        <p>Explainer text</p>
        <p>Explainer text</p>
        <p>Explainer text</p>
        <p>Explainer text</p>
        <p>Explainer text</p>
        <p>More explainer text</p>
        <p>More explainer text</p>
        <p>More explainer text</p>
        <p>More explainer text</p>
        <p>More explainer text</p>
        <p>More explainer text</p>
        <p>More explainer text</p>
        <ClientOnly>
            <Controls title="Controls" emotionModel={emotionModel} callback={() => {}}>
            <div>
                <h2>Emotion</h2>
            </div>
            </Controls>
        </ClientOnly>
      </div>
  );
};

export default SynthPage;

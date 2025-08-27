import type { Component } from 'solid-js';
import EmotionModel from '../lib/EmotionModel';
import Pareidolia from '../components/pareidolia/PareidoliaEmotion';
import ClientOnly from '../components/ui/ClientOnly';

const PareidoliaPage: Component = () => {
  const emotionModel = new EmotionModel();
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
    }}>
      <ClientOnly>
        <Pareidolia emotionModel={emotionModel} />
      </ClientOnly>
    </div>
  );
};

export default PareidoliaPage;

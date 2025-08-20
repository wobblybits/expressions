import type { Component } from 'solid-js';
import EmotionModel from '../../emotions/lib/EmotionModel';
import Pareidolia from '../../../components/pareidolia/PareidoliaEmotion';
import ClientOnly from '../../../lib/ClientOnly';

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

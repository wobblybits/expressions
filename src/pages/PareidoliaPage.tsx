import type { Component } from 'solid-js';
import EmotionModel from '../lib/EmotionModel';
import Pareidolia from '../emotions/Pareidolia';

const PareidoliaPage: Component = () => {
  const emotionModel = new EmotionModel();
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
    }}>
      <Pareidolia emotionModel={emotionModel} />
    </div>
  );
};

export default PareidoliaPage;

import type { Component } from 'solid-js';
import EmotionModel from '../lib/EmotionModel';
import PareidoliaCam from '../emotions/PareidoliaCam';

const PareidoliaPage: Component = () => {
  const emotionModel = new EmotionModel();
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
    }}>
      <PareidoliaCam emotionModel={emotionModel} />
    </div>
  );
};

export default PareidoliaPage;

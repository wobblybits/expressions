import type { Component } from 'solid-js';
import EmotionModel from '../lib/EmotionModel';
import PareidoliaCam from '../emotions/PareidoliaCam';

const CameraPage: Component = () => {
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

export default CameraPage;

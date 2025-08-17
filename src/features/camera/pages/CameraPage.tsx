import type { Component } from 'solid-js';
import EmotionModel from '../../emotions/lib/EmotionModel';
import PareidoliaCam from '../../pareidolia/components/PareidoliaCam';
import ClientOnly from '../../../lib/ClientOnly';

const CameraPage: Component = () => {
  const emotionModel = new EmotionModel();
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
    }}>
      <ClientOnly>
        <PareidoliaCam/>
      </ClientOnly>
    </div>
  );
};

export default CameraPage;

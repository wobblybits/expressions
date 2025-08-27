import type { Component } from 'solid-js';
import EmotionModel from '../lib/EmotionModel';
import PareidoliaCam from '../components/pareidolia/PareidoliaCam';
import ClientOnly from '../components/ui/ClientOnly';

const CameraPage: Component = () => {
  const emotionModel = new EmotionModel();
  return (
      <ClientOnly>
        <PareidoliaCam/>
      </ClientOnly>
  );
};

export default CameraPage;

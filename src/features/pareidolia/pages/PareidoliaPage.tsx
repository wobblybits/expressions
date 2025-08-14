import type { Component } from 'solid-js';
import EmotionModel from '../../emotions/lib/EmotionModel';
import Pareidolia from '../../emotions/components/Pareidolia';
import ClientOnly from '../../../lib/ClientOnly';

const PareidoliaPage: Component = () => {
  const emotionModel = new EmotionModel();
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
    }}>
      <ClientOnly 
        fallback={
          <div class="flex items-center justify-center h-full">
            <div class="text-center">
              <p class="text-lg">Loading pareidolia...</p>
            </div>
          </div>
        }
      >
        <Pareidolia emotionModel={emotionModel} />
      </ClientOnly>
    </div>
  );
};

export default PareidoliaPage;

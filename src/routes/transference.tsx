import { Component, lazy } from 'solid-js';
import ClientOnly from '../lib/ClientOnly';
import PageLayout from '../components/ui/PageLayout';

const GamePage = lazy(() => import('../features/emotions/pages/GamePage'));

const Game: Component = () => {
  return (
    <PageLayout 
      title="Emotion Game" 
      description="Interactive emotion detection game"
    >
      <ClientOnly 
        fallback={
          <div class="flex items-center justify-center h-96 bg-gray-800">
            <div class="text-center">
              <div class="animate-pulse bg-gray-600 w-96 h-64 mx-auto mb-4 rounded"></div>
              <p class="text-lg">Loading emotion game...</p>
              <p class="text-sm text-gray-400">Preparing interactive emotion detection</p>
            </div>
          </div>
        }
      >
        <GamePage />
      </ClientOnly>
    </PageLayout>
  );
};

export default Game; 
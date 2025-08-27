import { Component, lazy } from 'solid-js';
import ClientOnly from '../components/ui/ClientOnly';
import PageLayout from '../components/ui/PageLayout';

const GamePage = lazy(() => import('../pages/GamePage'));

const Game: Component = () => {
  return (
    <PageLayout 
      title="Emotion Game" 
      description="Interactive emotion detection game"
    >
      <ClientOnly>
        <GamePage />
      </ClientOnly>
    </PageLayout>
  );
};

export default Game; 
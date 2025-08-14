import { Component, createSignal, onMount } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';
import GamePage from '../features/emotions/pages/GamePage';

const Game: Component = () => {
  const [mounted, setMounted] = createSignal(false);

  onMount(() => setMounted(true));

  return (
    <PageLayout 
      title="Emotion Game" 
      description="Interactive emotion detection game"
    >
      {mounted() ? (
        <GamePage />
      ) : (
        <div>Loading emotion game...</div>
      )}
    </PageLayout>
  );
};

export default Game; 
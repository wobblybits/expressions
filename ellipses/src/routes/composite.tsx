import { Component, createSignal, onMount } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';
import CompositePage from '../features/emotions/pages/CompositePage';

const Composite: Component = () => {
  const [mounted, setMounted] = createSignal(false);

  onMount(() => setMounted(true));

  return (
    <PageLayout 
      title="Composite Emotions" 
      description="Explore emotion combinations and matrices"
    >
      {mounted() ? (
        <CompositePage />
      ) : (
        <div>Loading emotion matrix...</div>
      )}
    </PageLayout>
  );
};

export default Composite; 
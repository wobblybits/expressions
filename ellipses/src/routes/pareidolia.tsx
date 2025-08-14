import { Component, createSignal, onMount } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';
import PareidoliaPage from '../features/pareidolia/pages/PareidoliaPage';

const Pareidolia: Component = () => {
  const [mounted, setMounted] = createSignal(false);

  onMount(() => setMounted(true));

  return (
    <PageLayout 
      title="Pareidolia" 
      description="See faces in abstract patterns"
    >
      {mounted() ? (
        <PareidoliaPage />
      ) : (
        <div>Loading pareidolia viewer...</div>
      )}
    </PageLayout>
  );
};

export default Pareidolia; 
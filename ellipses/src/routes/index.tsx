import { Component, onMount } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';

const Home: Component = () => {
  let containerRef: HTMLDivElement;

  onMount(async () => {
    // Dynamically import and render the component after mount
    const { default: CameraPage } = await import('../features/camera/pages/CameraPage');
    const { render } = await import('solid-js/web');
    
    render(() => <CameraPage />, containerRef);
  });

  return (
    <PageLayout 
      title="Emotional Expression Camera" 
      description="Real-time emotion detection using your camera"
    >
      <div ref={containerRef!}>Loading camera...</div>
    </PageLayout>
  );
};

export default Home; 
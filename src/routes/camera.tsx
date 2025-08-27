import { Component, lazy } from 'solid-js';
import ClientOnly from '../components/ui/ClientOnly';
import PageLayout from '../components/ui/PageLayout';
import CameraPage from '../pages/CameraPage';

const Home: Component = () => {
  return (
    <PageLayout 
      title="Emotional Expression Camera" 
      description="Real-time emotion detection using your camera"
    >
        <CameraPage />
    </PageLayout>
  );
};

export default Home;

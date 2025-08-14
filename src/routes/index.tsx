import { Component, lazy } from 'solid-js';
import ClientOnly from '../lib/ClientOnly';
import PageLayout from '../components/ui/PageLayout';

const CameraPage = lazy(() => import('../features/camera/pages/CameraPage'));

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

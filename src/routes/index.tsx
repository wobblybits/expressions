import { Component, lazy } from 'solid-js';
import ClientOnly from '../lib/ClientOnly';
import PageLayout from '../components/PageLayout';

const CameraPage = lazy(() => import('../pages/CameraPage'));

const Home: Component = () => {
  return (
    <PageLayout 
      title="Emotional Expression Camera" 
      description="Real-time emotion detection using your camera"
    >
      <ClientOnly 
        fallback={
          <div class="flex items-center justify-center h-96 bg-gray-800">
            <div class="text-center">
              <div class="animate-pulse bg-gray-600 w-64 h-48 mx-auto mb-4 rounded"></div>
              <p class="text-lg">Loading camera interface...</p>
              <p class="text-sm text-gray-400">This requires JavaScript and camera permissions</p>
            </div>
          </div>
        }
      >
        <CameraPage />
      </ClientOnly>
      
      <noscript>
        <div class="p-8 bg-yellow-600 text-black">
          <h2 class="text-xl font-bold mb-2">JavaScript Required</h2>
          <p>This application requires JavaScript to access your camera and provide real-time emotion detection.</p>
        </div>
      </noscript>
    </PageLayout>
  );
};

export default Home;

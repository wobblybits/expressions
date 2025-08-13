import { Component, lazy } from 'solid-js';
import ClientOnly from '../lib/ClientOnly';
import PageLayout from '../components/PageLayout';

const PareidoliaPage = lazy(() => import('../pages/PareidoliaPage'));

const Pareidolia: Component = () => {
  return (
    <PageLayout 
      title="Pareidolia Visualization" 
      description="See faces in abstract patterns and emotions"
    >
      <ClientOnly 
        fallback={
          <div class="flex items-center justify-center h-96 bg-gray-800">
            <div class="text-center">
              <div class="animate-pulse bg-gray-600 w-80 h-80 mx-auto mb-4 rounded-full"></div>
              <p class="text-lg">Loading pareidolia visualization...</p>
              <p class="text-sm text-gray-400">Preparing abstract face patterns</p>
            </div>
          </div>
        }
      >
        <PareidoliaPage />
      </ClientOnly>
    </PageLayout>
  );
};

export default Pareidolia; 
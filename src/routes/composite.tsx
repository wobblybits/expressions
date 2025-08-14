import { Component, lazy } from 'solid-js';
import ClientOnly from '../lib/ClientOnly';
import PageLayout from '../components/ui/PageLayout';

const CompositePage = lazy(() => import('../features/emotions/pages/CompositePage'));

const Composite: Component = () => {
  return (
    <PageLayout 
      title="Composite Emotions" 
      description="Explore emotion combinations and matrices"
    >
      <ClientOnly 
        fallback={
          <div class="flex items-center justify-center h-96 bg-gray-800">
            <div class="text-center">
              <div class="grid grid-cols-4 gap-2 w-64 mx-auto mb-4">
                {Array.from({length: 16}).map((_, i) => (
                  <div class="animate-pulse bg-gray-600 w-12 h-12 rounded"></div>
                ))}
              </div>
              <p class="text-lg">Loading emotion matrix...</p>
              <p class="text-sm text-gray-400">Preparing composite visualization</p>
            </div>
          </div>
        }
      >
        <CompositePage />
      </ClientOnly>
    </PageLayout>
  );
};

// @ts-ignore
Composite.ssr = false;

export default Composite; 
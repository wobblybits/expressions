import { Component, lazy } from 'solid-js';
import ClientOnly from '../lib/ClientOnly';
import PageLayout from '../components/ui/PageLayout';

const PareidoliaPage = lazy(() => import('../features/pareidolia/pages/PareidoliaPage'));

const Pareidolia: Component = () => {
  return (
    <PageLayout 
      title="Pareidolia Visualization" 
      description="See faces in abstract patterns and emotions"
    >
      <ClientOnly>
        <PareidoliaPage />
      </ClientOnly>
    </PageLayout>
  );
};

export default Pareidolia; 
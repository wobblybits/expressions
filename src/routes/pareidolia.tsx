import { Component, lazy } from 'solid-js';
import ClientOnly from '../components/ui/ClientOnly';
import PageLayout from '../components/ui/PageLayout';
import PareidoliaPage from '../pages/PareidoliaPage';

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
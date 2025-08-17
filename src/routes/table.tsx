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
          <div id="loading">Loading...</div>
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
import { Component } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';
import ClientOnly from '../components/ui/ClientOnly';
import CompositePage from '../pages/CompositePage';

const Composite: Component = () => {
  return (
    <PageLayout 
      title="Composite Emotions" 
      description="Explore emotion combinations and matrices"
    >
      <ClientOnly>
        <CompositePage />
      </ClientOnly>
    </PageLayout>
  );
};

export default Composite; 
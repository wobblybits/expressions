import { Component } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';
import CompositePage from '../features/emotions/pages/CompositePage';

const Composite: Component = () => {
  return (
    <PageLayout 
      title="Composite Emotions" 
      description="Explore emotion combinations and matrices"
    >
      <CompositePage />
    </PageLayout>
  );
};

export default Composite; 
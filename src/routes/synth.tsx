import { Component } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';
import SynthPage from '../pages/SynthPage';

const Synth: Component = () => {
  return (
    <PageLayout 
      title="Composite Emotions" 
      description="Explore emotion combinations and matrices"
    >
      <SynthPage />
    </PageLayout>
  );
};

export default Synth; 
import { Component } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';
import SynthPage from '../features/emotions/pages/SynthPage';

const Synth: Component = () => {
  return (
    <PageLayout 
      title="Composite Emotions" 
      description="Explore emotion combinations and matrices"
    >
      <h2>Hello World</h2>
      <SynthPage />
    </PageLayout>
  );
};

export default Synth; 
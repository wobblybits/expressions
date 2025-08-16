import { Component } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';

const About: Component = () => {
  return (
    <PageLayout 
      title="About" 
      description=""
    >
      <div class='flex flex-col items-center justify-center w-full h-full max-w-[90vw] p-4 max-h-screen'>
        <h1>Feelings and Faces</h1>
        <p>This site represents a collection of related (and ongoing) projects that originated at <a href="https://www.recurse.com/" target="_blank">Recurse Center</a>. The impetus was to explore a domain where lay intuition is quite strong but where exact modeling is quite slippery -- like natural language -- but not so vast. The question of how to define emotions happened to stumble into the crosshairs. It is a topic I had enjoyed reading about in the past, as it sits at the intersection of many different disciplines, including philosophy, and a few impromptu conversations with fellow recurser <a href="https://www.gagekrause.com/" target="_blank">Gage Krause</a> who has an academic background in the philosophy of psychology helped to solidify the idea.</p>
      </div>
    </PageLayout>
  );
};

export default About;
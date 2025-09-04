import type { Component } from 'solid-js';
import Mesh from '../components/threejs/Mesh';
import ClientOnly from '../components/ui/ClientOnly';

const DetectPage: Component = () => {
  return (
      <ClientOnly>
        <Mesh id="detect" width={640} height={640}/>
      </ClientOnly>
  );
};

export default DetectPage;

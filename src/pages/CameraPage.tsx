import type { Component } from 'solid-js';
import PareidoliaCam from '../components/pareidolia/PareidoliaCam';
import ClientOnly from '../components/ui/ClientOnly';

const CameraPage: Component = () => {
  return (
      <ClientOnly>
        <PareidoliaCam/>
      </ClientOnly>
  );
};

export default CameraPage;

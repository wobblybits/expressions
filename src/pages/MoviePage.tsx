import type { Component } from 'solid-js';
import PareidoliaMovie from '../components/pareidolia/PareidoliaMovie';
import ClientOnly from '../components/ui/ClientOnly';

const MoviePage: Component = () => {
  return (
      <ClientOnly>
        <PareidoliaMovie/>
      </ClientOnly>
  );
};

export default MoviePage;

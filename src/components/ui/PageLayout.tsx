import { Component, JSX } from 'solid-js';
import Navigation from './Navigation';
import ClientOnly from '../../lib/ClientOnly';

interface PageLayoutProps {
  title: string;
  description?: string;
  children: JSX.Element;
}

const PageLayout: Component<PageLayoutProps> = (props) => {
  return (
    <ClientOnly 
      fallback={
        <div class="min-h-screen flex items-center justify-center">
          <div id='loading'>Loading...</div>
        </div>
      }
    >
      <div class="min-h-screen">
        <main>
          {props.children}
        </main>
      </div>
    </ClientOnly>
  );
};

export default PageLayout; 
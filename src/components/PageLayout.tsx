import { Component, JSX } from 'solid-js';
import Navigation from './Navigation.tsx';

interface PageLayoutProps {
  title: string;
  description?: string;
  children: JSX.Element;
}

const PageLayout: Component<PageLayoutProps> = (props) => {
  return (
    <div class="min-h-screen bg-gray-900 text-white">
      <header class="p-4 bg-gray-800">
        <h1 class="text-2xl font-bold">{props.title}</h1>
        {props.description && (
          <p class="text-gray-300">{props.description}</p>
        )}
      </header>
      
      <Navigation />
      
      <main>
        {props.children}
      </main>
    </div>
  );
};

export default PageLayout; 
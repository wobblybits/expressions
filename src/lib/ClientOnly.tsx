import { Component, JSX, Show } from 'solid-js';
import { isServer } from 'solid-js/web';

interface ClientOnlyProps {
  children: JSX.Element;
  fallback?: JSX.Element;
}

const ClientOnly: Component<ClientOnlyProps> = (props) => {
  return (
    <Show 
      when={!isServer} 
      fallback={props.fallback || <div id='loading'>Loading interactive content...</div>}
    >
      {props.children}
    </Show>
  );
};

export default ClientOnly; 
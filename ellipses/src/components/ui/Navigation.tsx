import { Component } from 'solid-js';
import { A } from '@solidjs/router';

interface NavItem {
  path: string;
  label: string;
  description?: string;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Camera', description: 'Real-time emotion detection' },
  { path: '/game', label: 'Game', description: 'Interactive emotion challenges' },
  { path: '/pareidolia', label: 'Pareidolia', description: 'Abstract face patterns' },
  { path: '/composite', label: 'Composite', description: 'Emotion combinations' },
  { path: '/about', label: 'About', description: 'Learn more' }
];

const Navigation: Component = () => {
  return (
    <nav class="p-4 bg-gray-700">
      <ul class="flex flex-wrap gap-4">
        {navItems.map((item) => (
          <li>
            <A 
              href={item.path} 
              class="block px-3 py-2 rounded transition-colors text-blue-400 hover:text-blue-300 hover:bg-gray-600"
              title={item.description}
            >
              {item.label}
            </A>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navigation; 
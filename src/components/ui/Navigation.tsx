import { Component } from 'solid-js';
import { useLocation } from '@solidjs/router';

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
  const location = useLocation();
  
  return (
    <nav class="p-4 bg-gray-700">
      <ul class="flex flex-wrap gap-4 flex-row">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <li>
              <input type="button" 
                onClick={() => window.location.href = item.path} 
                class={`block px-3 py-2 rounded transition-colors ${
                  isActive 
                    ? ('grid-background') 
                    : ('')
                }`}
                title={item.description}
                value={item.label}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default Navigation; 
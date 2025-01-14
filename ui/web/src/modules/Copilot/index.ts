import './Copilot';
import { registerCopilotMessageBlock } from './Copilot';

for (const [key, value] of Object.entries(import.meta.glob('./components/*.tsx', { eager: true }))) {
  const name = key.match(/\.\/components\/(.*)\.tsx/)![1];
  const component = (value as any).default;
  if (component) {
    registerCopilotMessageBlock(name, component);
  }
}

import './Chat';

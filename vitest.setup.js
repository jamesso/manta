import { vi } from 'vitest';
import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

// Was jest.shim.js
global.requestAnimationFrame = callback => {
  setTimeout(callback, 0);
};

// Was jest.setup.js
Enzyme.configure({ adapter: new Adapter() });

// These two CommonJS modules touch Electron/Node at import time.
// Replace them with their __mocks__ versions in every test file.
vi.mock('./app/renderers/dialog.js');
vi.mock('./libs/sounds.js');

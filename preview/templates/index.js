import Business from './business/index.jsx';
import Minimal from './minimal/index.jsx';

export function getTemplate(name) {
  if (name === 'business') {
    return Business;
  }
  return Minimal;
}

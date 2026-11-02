import Business from './business/index.jsx';
import Minimal from './minimal/index.jsx';
import StyledRoot from './StyledRoot.jsx';

export function getTemplate(name) {
  if (name === 'business') {
    return Business;
  }
  return Minimal;
}

export function InvoiceTemplate(props) {
  const Template = props.configs?.template === 'business' ? Business : Minimal;
  return (
    <StyledRoot>
      <Template {...props} />
    </StyledRoot>
  );
}

import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <Popup />
    </StrictMode>
  );
}

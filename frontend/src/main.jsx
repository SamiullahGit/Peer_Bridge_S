import React          from 'react';
import { createRoot }  from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App             from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { initTheme }    from './theme.js';

import './styles/shared.css';
import './styles/dark.css';
import './styles/xpToast.css';
import './styles/certificate.css';

initTheme();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

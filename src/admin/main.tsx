import React from 'react';
import {createRoot} from 'react-dom/client';
import Admin from './Admin';
import './admin.css';
import '../visual-refresh.css';
createRoot(document.getElementById('admin-root')!).render(<React.StrictMode><Admin/></React.StrictMode>);

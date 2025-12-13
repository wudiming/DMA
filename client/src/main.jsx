import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n'
import { EndpointProvider } from './context/EndpointContext';

ReactDOM.createRoot(document.getElementById('root')).render(
    <EndpointProvider>
        <App />
    </EndpointProvider>,
)

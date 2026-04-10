import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/index.css';
import App from './App';
import { store } from './store';

const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;
const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <Router future={routerFutureFlags}>
        <App />
        <Toaster position="top-right" />
      </Router>
    </Provider>
  </React.StrictMode>
);

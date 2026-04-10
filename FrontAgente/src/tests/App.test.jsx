import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { store } from '../store';

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
};

describe('App', () => {
  it('renderiza el dashboard vacio', () => {
    render(
      <Provider store={store}>
        <BrowserRouter future={routerFutureFlags}>
          <App />
        </BrowserRouter>
      </Provider>
    );

    expect(screen.getByText(/Dashboard en blanco/i)).toBeInTheDocument();
  });
});

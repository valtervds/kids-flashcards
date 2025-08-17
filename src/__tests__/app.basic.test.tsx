import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import React from 'react';

describe('App básico', () => {
  it('avalia resposta correta digitada', () => {
    render(<App />);
  const input = screen.getByPlaceholderText(/Digite ou use o microfone/i);
    fireEvent.change(input, { target: { value: 'Brasília' } });
    fireEvent.click(screen.getByText(/Enviar/i));
  expect(screen.getByText(/Correto/)).toBeInTheDocument();
  });
});

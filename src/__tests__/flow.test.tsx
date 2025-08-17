import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';

describe('Fluxo da aplicação', () => {
  test('avança para próxima pergunta reseta estado', () => {
    render(<App />);
  const input = screen.getByPlaceholderText(/Digite ou use o microfone/i);
    fireEvent.change(input, { target: { value: 'Brasília' } });
    fireEvent.click(screen.getByText('Enviar'));
    expect(screen.getByText(/Correto/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Próxima pergunta/));
    expect(screen.queryByText(/Correto/)).toBeNull();
  });

  test('fluxo voz com auto-avaliação desligada exige envio manual', () => {
    render(<App />);
    const checkbox = screen.getByRole('checkbox', { name: /Auto avaliar voz/i });
    fireEvent.click(checkbox); // desliga
    fireEvent.click(screen.getByTestId('simular-voz'));
    expect(screen.queryByText(/Correto/)).toBeNull();
    fireEvent.click(screen.getByText(/Enviar/));
    expect(screen.getByText(/Correto/)).toBeInTheDocument();
  });
});

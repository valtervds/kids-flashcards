import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';

describe('Fluxo da aplicação', () => {
  test('avança para próxima pergunta reseta estado', () => {
    render(<App />);
    const input = screen.getByPlaceholderText(/Digite sua resposta/i);
    fireEvent.change(input, { target: { value: 'Brasília' } });
    fireEvent.click(screen.getByText('Enviar'));
    expect(screen.getByText(/Correto/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Próxima pergunta/));
    expect(screen.queryByText(/Correto/)).toBeNull();
  });

  test('auto-avaliação por voz ligada avalia automaticamente e desligada exige ação manual', () => {
    render(<App />);
    // Simular voz com auto-avaliação ligada
    fireEvent.click(screen.getByTestId('simular-voz'));
    expect(screen.getByText(/Correto/)).toBeInTheDocument();
    // Avançar e desligar auto-avaliação
    fireEvent.click(screen.getByText(/Próxima pergunta/));
    const checkbox = screen.getByRole('checkbox', { name: /Auto avaliar resposta de voz/i });
    fireEvent.click(checkbox); // desliga
    // Simular voz novamente
    fireEvent.click(screen.getByTestId('simular-voz'));
    // Deve mostrar "Você disse:" mas ainda não resultado
    expect(screen.getByText(/Você disse:/)).toBeInTheDocument();
    expect(screen.queryByText(/Correto/)).toBeNull();
  });
});

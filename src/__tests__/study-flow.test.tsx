import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';

// Helper para navegar para estudo do deck default criado em runtime

describe('Study Flow', () => {
  test('permite estudar deck local simples', async () => {
    render(<App />);
    // Ir para baralhos
    const navStudy = await screen.findByText('Baralhos');
    fireEvent.click(navStudy);
    // Criar novo baralho
    const nomeInput = await screen.findByPlaceholderText('Nome do baralho');
    fireEvent.change(nomeInput, { target: { value: 'Teste 1' } });
    fireEvent.click(screen.getByText('Criar'));
  // Expandir deck recém criado
  fireEvent.click(screen.getByText('Editar'));
  const perguntaInput = await screen.findByPlaceholderText('Pergunta');
    fireEvent.change(perguntaInput, { target: { value: 'Capital do Brasil?' } });
    const respostasInput = await screen.findByPlaceholderText('Resp1 | Resp2');
    fireEvent.change(respostasInput, { target: { value: 'Brasília' } });
  fireEvent.click(screen.getByText('+'));
  // Reabrir edição (state reset due to inline component redef)
  fireEvent.click(screen.getByText('Editar'));
  const estudarBtn = await screen.findByText('Estudar este');
  fireEvent.click(estudarBtn);
    // Deve mostrar pergunta
    await screen.findByText(/Capital do Brasil/i);
    const respostaCampo = screen.getByLabelText('Campo de resposta');
    fireEvent.change(respostaCampo, { target: { value: 'brasilia' } });
    fireEvent.click(screen.getAllByText('Enviar')[0]);
  await waitFor(() => expect(screen.getByText(/Resultado/)).toBeInTheDocument());
  expect(screen.getByText(/Correto!/)).toBeInTheDocument();
    // Próxima pergunta (só 1 carta, deve circular ou manter)
    fireEvent.click(screen.getAllByText('Próxima pergunta')[0]);
  }, 15000);
});

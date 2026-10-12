import '@fontsource-variable/inter';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { BootError, BootScreen } from './app/BootScreen';
import { connectBackend } from './data/backend';

const root = createRoot(document.getElementById('root')!);

// Mostra o carregamento na hora: testar o Firebase pode levar alguns segundos.
root.render(<BootScreen />);

// Escolhe a camada de dados (Firebase ou local) antes de desenhar as telas do app.
connectBackend()
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((error: unknown) => {
    // Só acontece com VITE_DATA_MODE=firebase (sem queda para o modo local).
    console.error(error);
    root.render(<BootError code={String((error as { code?: unknown }).code ?? 'UNKNOWN')} />);
  });

import '@fontsource-variable/inter';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { connectBackend } from './data/backend';

const root = createRoot(document.getElementById('root')!);

// Escolhe a camada de dados (Firebase ou local) antes de desenhar qualquer tela.
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
    root.render(
      <p style={{ padding: 32, fontFamily: 'sans-serif' }}>
        Não foi possível conectar ao Firebase. Verifique a configuração e recarregue a página.
      </p>,
    );
  });

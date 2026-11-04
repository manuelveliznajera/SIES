import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportFrontendError } from './adminLogsApi';

interface State {
  hasError: boolean;
}

export class FrontendErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void reportFrontendError({
      message: error.message || 'Error de renderizado en React.',
      ...(error.stack ? { stack: error.stack } : {}),
      path: window.location.pathname,
      details: { componentStack: info.componentStack?.slice(0, 12_000) },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem', background: '#f3f8fb' }}>
          <section style={{ maxWidth: 520, padding: '1.5rem', borderRadius: 16, background: '#fff', color: '#263238', textAlign: 'center' }}>
            <h1>Ocurrió un error en la aplicación</h1>
            <p>El error se registró para que el administrador pueda revisarlo. Recarga la página para volver a intentarlo.</p>
            <button type="button" onClick={() => window.location.reload()}>Recargar aplicación</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

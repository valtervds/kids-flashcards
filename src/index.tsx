import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
	constructor(props: any) { super(props); this.state = { error: null }; }
	static getDerivedStateFromError(error: any) { return { error }; }
	componentDidCatch(error: any, info: any) { console.warn('[ErrorBoundary]', error, info); }
	render() {
		if (this.state.error) {
			return (
				<div style={{ padding:20, fontFamily:'sans-serif' }}>
					<h2>Ocorreu um erro na interface</h2>
					<pre style={{ whiteSpace:'pre-wrap', background:'#13263b', padding:10, borderRadius:4 }}>
						{String(this.state.error?.message || this.state.error)}
					</pre>
					<button onClick={()=> { this.setState({ error:null }); }} className="btn">Tentar novamente</button>
					<button style={{ marginLeft:8 }} className="btn btn-secondary" onClick={()=> window.location.reload()}>Recarregar</button>
				</div>
			);
		}
		return this.props.children as any;
	}
}
import "./global.css";

console.log('[index.tsx] carregando aplicação v2025-08-17-1');
const container = document.getElementById("root");
if (!container) {
	console.error('Elemento #root não encontrado');
} else {
	const root = createRoot(container);
	root.render(<ErrorBoundary><App /></ErrorBoundary>);
	console.log('[index.tsx] App renderizado');
}

// Ajuda a evitar cache antigo de service worker causando chunks desatualizados (TDZ fantasma)
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.getRegistrations().then(regs => {
		regs.forEach(r => {
			// Força unregister em dev/preview para evitar servir chunks antigos que causam ReferenceError/TDZ
			r.unregister().then(ok => console.log('[sw] unregister', r.scope, ok));
		});
	});
	// Extra: limpa alguns caches nomeados comuns (ignora erros)
	if ((window as any).caches) {
		caches.keys().then(keys => {
			keys.forEach(k => { if (/workbox|vite|^cache-/.test(k)) { caches.delete(k).then(()=> console.log('[cache] deletado', k)); } });
		});
	}
}

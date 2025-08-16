import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

console.log('[index.tsx] carregando aplicação');
const container = document.getElementById("root");
if (!container) {
	console.error('Elemento #root não encontrado');
} else {
	const root = createRoot(container);
	root.render(<App />);
	console.log('[index.tsx] App renderizado');
}

# Gestión Deportiva de Temporada

Aplicación frontend estática (HTML/CSS/JavaScript ES6) con IndexedDB.

## Ejecutar
No abras `index.html` con `file://`, porque los módulos ES6 y `fetch` requieren un servidor HTTP.
Ejemplos:
- VS Code + Live Server
- `python -m http.server 8000`
- GitHub Pages

## Arquitectura
- `database.js`: repositorio IndexedDB reemplazable por una API REST.
- `players.js`: estadísticas derivadas del jugador.
- `participation.js`: cálculo dinámico de minutos y jugadores en campo.
- `matches.js`: reglas simples de partido.
- `statistics.js`: agregados estadísticos.
- `backup.js`: exportación/importación.
- `tactics.js` / `boardTools.js`: Pizarra Táctica (fichas, dibujo libre, redimensionado) y su matemática pura.
- `app.js`: navegación y presentación.
- `data/demo-data.json`: datos de demostración.

Los minutos, medias y victoria/empate/derrota se calculan, no se almacenan como datos redundantes.

# Implementación: Alineaciones + Pizarra Táctica

## Arquitectura detectada
Aplicación frontend estática: HTML5, CSS, Bootstrap 5.3, Font Awesome, JavaScript ES6 modular, Chart.js e IndexedDB. No existe backend ni base SQL.

## Archivos modificados
- `js/database.js`: IndexedDB v3 y almacenes `exercises` y `trainingExercises`.
- `js/lineups.js`: catálogo extensible de formaciones y posiciones nominales/coordenadas.
- `js/app.js`: navegación, nuevo flujo de alineaciones, Pizarra Táctica e integración en entrenamientos.
- `js/backup.js`: compatibilidad de copias antiguas con los nuevos almacenes.
- `css/styles.css`, `css/responsive.css`: interfaz profesional y responsive.

## Archivos creados
- `js/tactics.js`: biblioteca, editor de pizarra, persistencia y relación entrenamiento-ejercicio.
- `js/boardTools.js`: matemática pura de la pizarra (trazos suaves, flechas, borrador, redimensionado/rotación y límites). Sin DOM, fácil de probar.
- `IMPLEMENTACION_PIZARRA_ALINEACIONES.md`: este documento.

## Migración de datos
No hay SQL. IndexedDB sube de versión 2 a 3. Al abrir la aplicación se crean, sin borrar los existentes:
- `exercises`: ficha + `boardState` JSON + `preview` SVG editable/visualizable.
- `trainingExercises`: relación N:M entre entrenamientos y ejercicios, con orden.

## Manual breve
### Alineaciones
1. Abra Alineación y seleccione una formación.
2. Pulse una posición concreta del campo.
3. Seleccione un jugador y pulse **Asignar jugador**.
4. El mismo jugador se libera de su posición anterior si se reasigna.
5. Puede vaciar posiciones y guardar versiones de la alineación.
6. Los convocados no utilizados aparecen como suplentes.

Formaciones incluidas: 4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 3-4-3, 3-5-2, 5-3-2 y 5-4-1.

### Pizarra Táctica
1. Entre en **Pizarra Táctica** > **Nuevo ejercicio**.
2. Elija terreno y añada jugadores, material y elementos gráficos.
3. Arrastre los objetos para colocarlos; doble clic permite editar etiquetas.
4. Seleccione un objeto para cambiar color, duplicar, eliminar o cambiar su capa.
5. Use deshacer/rehacer y complete la ficha profesional del ejercicio.
6. Al guardar se conserva el JSON completo y una previsualización SVG.

### Biblioteca de ejercicios
Permite buscar, filtrar por categoría, abrir, editar, duplicar y eliminar ejercicios. El dibujo sigue siendo editable al volver a abrirlo.

### Integración con entrenamientos
1. Abra una ficha de entrenamiento.
2. En **EJERCICIOS DEL ENTRENAMIENTO**, pulse **Añadir ejercicio**.
3. Seleccione uno de la biblioteca.
4. El ejercicio queda relacionado sin duplicar su ficha.
5. Arrastre ejercicios para cambiar el orden o elimine la relación con ×.
6. La duración total se calcula sumando las duraciones de los ejercicios asociados.

## Ampliación: dibujo libre y redimensionado (v2)
### Herramienta de dibujo
1. Pulse **Dibujar** sobre la pizarra para activar/desactivar el modo dibujo (al desactivarlo vuelve el modo mover).
2. Elija herramienta: trazo libre, línea recta (Mayús = ángulos de 45°), flecha o borrador (elimina el trazo que toque).
3. Elija color (blanco, amarillo, rojo, azul, negro) y grosor.
4. **Deshacer/Rehacer** (también Ctrl+Z / Ctrl+Y) y **Borrar dibujos** (no toca las fichas).
Los dibujos viven en una capa SVG independiente por encima del campo y se guardan en `boardState.drawings` (coordenadas normalizadas 0–1), por lo que viajan con el ejercicio, la copia de seguridad y la miniatura.

### Redimensionar y girar elementos
- Al seleccionar una ficha aparece un recuadro con 8 tiradores. Esquina = escala proporcional; lateral = estira en una dirección (Mayús = proporcional).
- Tirador circular superior = girar (Mayús = saltos de 15°); botón rojo = eliminar. Con la tecla Supr también se elimina.
- Límites: mínimo 16 px por lado y máximo 80 % de la pizarra; la ficha no se sale del lienzo.
- Arrastrar el cuerpo mueve; arrastrar un tirador redimensiona. Clic fuera deselecciona.
- `width`, `height` y `rotation` de cada ficha se guardan con el ejercicio.

## Comprobaciones realizadas
- Validación sintáctica de todos los módulos JavaScript mediante `node --check`.
- Comprobación de que IndexedDB crea los nuevos almacenes de forma incremental.
- Revisión del flujo de persistencia de alineaciones, pizarra y entrenamiento-ejercicio.

## Nota de ejecución
Debe servirse por HTTP (por ejemplo Live Server o `python -m http.server 8000`), no abrirse directamente con `file://`.

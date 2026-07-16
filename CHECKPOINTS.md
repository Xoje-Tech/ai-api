# CHECKPOINTS — Evaluación del Estado Final (DoD)

Criterios objetivos que determinan si los cambios aplicados en una sesión están sanos y listos para ser integrados.

## C1 — El arnés está completo e intacto
- [ ] Existe `init.sh` (con permisos de ejecución) y finaliza con exit code 0.
- [ ] Existe `AGENTS.md` (mapa de navegación actualizado).
- [ ] Existe `CHECKPOINTS.md`.

## C2 — El estado del arnés es coherente
- [ ] `progress/current.md` está vacío o describe de manera precisa únicamente la sesión activa.
- [ ] Al cerrar la sesión, el progreso se consolidó en `progress/history.md`.

## C3 — Calidad del código y verificación
- [ ] El código respeta la arquitectura definida en `AGENTS.md`.
- [ ] No existen logs temporales, `console.log` de debug o comentarios TODO sin resolver.
- [ ] Toda nueva feature cuenta con pruebas automatizadas asociadas que pasan en verde.

---

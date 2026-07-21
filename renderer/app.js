// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let materias = [];
let areas = [];
let perfiles = [];
let vistaActual = 'materias';
let popupMateriaActual = null;
let popupTabActual = 'previas';
let editandoId = null;
let confirmCallback = null;

// ═══════════════════════════════════════════════
// DOM REFS
// ═══════════════════════════════════════════════
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const creditosDisplay = $('#creditos-display');
const materiasContainer = $('#materias-container');
const inputBuscar = $('#input-buscar');
const filtroArea = $('#filtro-area');
const filtroSemestre = $('#filtro-semestre');

const seccionMaterias = $('#seccion-materias');
const seccionFormulario = $('#seccion-formulario');

const formMateria = $('#form-materia');
const formTitulo = $('#form-titulo');
const formMateriaId = $('#form-materia-id');
const formNombre = $('#form-nombre');
const formCreditos = $('#form-creditos');
const formCreditosReq = $('#form-creditos-req');
const formSemestre = $('#form-semestre');
const formTipo = $('#form-tipo');
const formArea = $('#form-area');
const formPerfil = $('#form-perfil');

const popupMateria = $('#popup-materia');
const popupTitulo = $('#popup-titulo');
const popupContenido = $('#popup-contenido');

const popupConfirmar = $('#popup-confirmar');
const confirmTitulo = $('#confirm-titulo');
const confirmTexto = $('#confirm-texto');

const toastEl = $('#toast');

const navBotones = $$('.navbar-boton[data-vista]');
const navbar = $('#navbar');

// Modales nuevos
const popupNuevaArea = $('#popup-nueva-area');
const inputNuevaArea = $('#input-nueva-area');
const popupNuevoPerfil = $('#popup-nuevo-perfil');
const inputNuevoPerfil = $('#input-nuevo-perfil');
const popupCreditosArea = $('#popup-creditos-area');
const contenidoCreditosArea = $('#contenido-creditos-area');

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatosIniciales();
    await cargarMaterias();
    initEventos();
    initModoOscuro();
});

async function cargarDatosIniciales() {
    const resAreas = await window.api.listarAreas();
    if (resAreas.success) {
        areas = resAreas.areas;
        poblarSelectAreas();
    }
    const resPerfiles = await window.api.listarPerfiles();
    if (resPerfiles.success) {
        perfiles = resPerfiles.perfiles;
        poblarSelectPerfiles();
    }
}

function poblarSelectAreas() {
    formArea.innerHTML = '<option value="" disabled selected>Seleccioná un área...</option>';
    filtroArea.innerHTML = '<option value="">Todas las Áreas</option>';
    areas.forEach(a => {
        formArea.innerHTML += `<option value="${a.id}">${a.nombre}</option>`;
        filtroArea.innerHTML += `<option value="${a.id}">${a.nombre}</option>`;
    });
}

function poblarSelectPerfiles() {
    formPerfil.innerHTML = '<option value="">Sin perfil específico</option>';
    perfiles.forEach(p => {
        formPerfil.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
    });
}

async function cargarMaterias() {
    const result = await window.api.listarMaterias();
    if (result.success) {
        materias = result.materias;
        
        // Calcular el número total de previas (recursivamente) para cada materia
        materias.forEach(m => {
            m.totalPrevias = calcularTotalPrevias(m.id);
        });

        // Ordenar: primero por cantidad de previas (ascendente), luego alfabéticamente
        materias.sort((a, b) => {
            if (a.totalPrevias !== b.totalPrevias) {
                return a.totalPrevias - b.totalPrevias;
            }
            return a.nombre.localeCompare(b.nombre);
        });

        renderMaterias();
        actualizarCreditos();
    }
}

function calcularTotalPrevias(materiaId) {
    const requeridas = new Set();
    const cola = [materiaId];
    
    while(cola.length > 0) {
        const actualId = cola.shift();
        const m = materias.find(x => x.id === actualId);
        if (m) {
            const dependencias = [];
            if (m.previasAprobadas) dependencias.push(...m.previasAprobadas.map(p => p.id));
            if (m.previasCurso) dependencias.push(...m.previasCurso.map(p => p.id));
            
            for (const dep of dependencias) {
                if (!requeridas.has(dep)) {
                    requeridas.add(dep);
                    cola.push(dep);
                }
            }
        }
    }
    return requeridas.size;
}

async function actualizarCreditos() {
    const result = await window.api.calcularCreditos();
    if (result.success) {
        creditosDisplay.textContent = result.total;
    }
}

// ═══════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════
function initEventos() {
    // Navegación
    navBotones.forEach(btn => {
        btn.addEventListener('click', () => {
            cambiarVista(btn.dataset.vista);
        });
    });

    $('#nav-reset').addEventListener('click', () => {
        mostrarConfirmacion(
            'Resetear Estados',
            '¿Estás seguro de que querés resetear todos los estados? Las materias volverán a su estado según sus previas.',
            async () => {
                const result = await window.api.resetearEstados();
                if (result.success) {
                    materias = result.materias;
                    renderMaterias();
                    actualizarCreditos();
                    toast('Estados reseteados');
                }
            }
        );
    });

    // Menú hamburguesa
    $('#btn-menu').addEventListener('click', () => {
        navbar.classList.toggle('oculto');
    });

    // Búsqueda y Filtros
    inputBuscar.addEventListener('input', () => {
        renderMaterias();
    });
    filtroArea.addEventListener('change', () => {
        renderMaterias();
    });
    filtroSemestre.addEventListener('change', () => {
        renderMaterias();
    });

    // Formulario
    formMateria.addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarMateria();
    });

    $('#btn-cancelar-form').addEventListener('click', () => {
        cambiarVista('materias');
    });

    // Popup materia - tabs
    $$('.popup-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            popupTabActual = tab.dataset.tab;
            $$('.popup-tab').forEach(t => t.classList.remove('activo'));
            tab.classList.add('activo');
            renderPopupContenido();
        });
    });

    // Popup materia - botones
    $('#popup-btn-cerrar').addEventListener('click', cerrarPopup);
    $('#popup-btn-editar').addEventListener('click', () => {
        const materia = popupMateriaActual;
        cerrarPopup();
        editarMateria(materia);
    });
    $('#popup-btn-eliminar').addEventListener('click', () => {
        const materia = popupMateriaActual;
        cerrarPopup();
        mostrarConfirmacion(
            'Eliminar Materia',
            `¿Estás seguro de que querés eliminar "${materia.nombre}"? Se eliminarán también las referencias de previas.`,
            async () => {
                const result = await window.api.eliminarMateria(materia.id);
                if (result.success) {
                    await cargarMaterias();
                    toast('Materia eliminada');
                }
            }
        );
    });

    // Popup overlay click to close
    popupMateria.addEventListener('click', (e) => {
        if (e.target === popupMateria) cerrarPopup();
    });

    // Confirmar
    $('#confirm-btn-cancelar').addEventListener('click', cerrarConfirmacion);
    $('#confirm-btn-aceptar').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        cerrarConfirmacion();
    });
    popupConfirmar.addEventListener('click', (e) => {
        if (e.target === popupConfirmar) cerrarConfirmacion();
    });

    // Modo oscuro
    $('#toggle-modo-oscuro').addEventListener('change', (e) => {
        document.body.classList.toggle('modo-oscuro', e.target.checked);
        localStorage.setItem('modo-oscuro', e.target.checked ? '1' : '0');
    });

    // Multi-select buscadores
    $$('.multi-select-buscar').forEach(input => {
        input.addEventListener('input', () => {
            filtrarMultiSelect(input);
        });
    });

    // Nuevas Áreas y Perfiles
    $('#btn-nueva-area').addEventListener('click', () => {
        inputNuevaArea.value = '';
        popupNuevaArea.classList.add('visible');
    });

    $('#btn-cancelar-area').addEventListener('click', () => {
        popupNuevaArea.classList.remove('visible');
    });

    $('#btn-guardar-area').addEventListener('click', async () => {
        const nombre = inputNuevaArea.value.trim();
        if (!nombre) return;
        const res = await window.api.crearArea(nombre);
        if (res.success) {
            toast('Área agregada');
            popupNuevaArea.classList.remove('visible');
            await cargarDatosIniciales();
            formArea.value = res.id;
        } else {
            toast(res.error, true);
        }
    });

    $('#btn-nuevo-perfil').addEventListener('click', () => {
        inputNuevoPerfil.value = '';
        popupNuevoPerfil.classList.add('visible');
    });

    $('#btn-cancelar-perfil').addEventListener('click', () => {
        popupNuevoPerfil.classList.remove('visible');
    });

    $('#btn-guardar-perfil').addEventListener('click', async () => {
        const nombre = inputNuevoPerfil.value.trim();
        if (!nombre) return;
        const res = await window.api.crearPerfil(nombre);
        if (res.success) {
            toast('Perfil agregado');
            popupNuevoPerfil.classList.remove('visible');
            await cargarDatosIniciales();
            formPerfil.value = res.id;
        } else {
            toast(res.error, true);
        }
    });

    // Desglose de créditos por área
    $('#creditos-display').addEventListener('click', async () => {
        const res = await window.api.calcularCreditosPorArea();
        if (res.success) {
            let html = '';
            if (res.desglose.length === 0) {
                html = '<p style="text-align:center;color:var(--color-texto-secundario)">No hay créditos aprobados todavía.</p>';
            } else {
                html = '<ul class="popup-lista">';
                res.desglose.forEach(item => {
                    html += `<li><strong>${item.area}</strong>: ${item.total} créditos</li>`;
                });
                html += '</ul>';
            }
            contenidoCreditosArea.innerHTML = html;
            popupCreditosArea.classList.add('visible');
        }
    });

    $('#btn-cerrar-creditos').addEventListener('click', () => {
        popupCreditosArea.classList.remove('visible');
    });
}

// ═══════════════════════════════════════════════
// VISTAS
// ═══════════════════════════════════════════════
function cambiarVista(vista) {
    vistaActual = vista;

    // Toggle secciones
    seccionMaterias.style.display = vista === 'materias' ? 'block' : 'none';
    seccionFormulario.style.display = vista === 'formulario' ? 'block' : 'none';

    // Toggle botones nav
    navBotones.forEach(btn => {
        btn.classList.toggle('activo', btn.dataset.vista === vista);
    });

    // Si es formulario y no estamos editando, resetear
    if (vista === 'formulario' && !editandoId) {
        resetFormulario();
        cargarMultiSelects();
    }

    // Cerrar menú móvil
    if (window.innerWidth <= 700) {
        navbar.classList.add('oculto');
    }
}

// ═══════════════════════════════════════════════
// RENDER MATERIAS
// ═══════════════════════════════════════════════
function renderMaterias() {
    const filtroNombre = inputBuscar.value.toLowerCase().trim();
    const areaSel = filtroArea.value;
    const semestreSel = filtroSemestre.value;

    const filtradas = materias.filter(m => {
        // Filtro por nombre
        if (filtroNombre && !m.nombre.toLowerCase().includes(filtroNombre)) return false;
        
        // Filtro por área
        if (areaSel && m.area_id != areaSel) return false;
        
        // Filtro por semestre
        if (semestreSel) {
            // Si el select pide 1, mostramos '1' o 'AMBOS'
            // Si el select pide 2, mostramos '2' o 'AMBOS'
            if (m.semestre !== 'AMBOS' && m.semestre !== semestreSel) return false;
        }

        return true;
    });

    if (materias.length === 0) {
        materiasContainer.innerHTML = `
            <div class="empty-state">
                <div class="emoji">🌸</div>
                <p>No hay materias cargadas</p>
                <p class="hint">Usá el botón "Agregar Materia" para empezar</p>
            </div>
        `;
        return;
    }

    if (filtradas.length === 0) {
        materiasContainer.innerHTML = `
            <div class="empty-state">
                <div class="emoji">🎀</div>
                <p>No se encontraron materias</p>
                <p class="hint">Probá con otro término de búsqueda</p>
            </div>
        `;
        return;
    }

    materiasContainer.innerHTML = filtradas.map(m => {
        const estadoClase = m.estado.toLowerCase().replace('_', '-');
        const estadoTexto = {
            'APROBADA': 'Exonerada',
            'CURSO': 'Aprobada',
            'DISPONIBLE': 'Disponible',
            'NO_DISPONIBLE': 'No disponible'
        }[m.estado];

        return `
            <button class="materia-card ${estadoClase}"
                    data-id="${m.id}"
                    title="${m.nombre} - ${estadoTexto}">
                <span class="materia-nombre">${m.nombre}</span>
                <span class="materia-creditos">${m.creditos} créditos • ${m.totalPrevias} previas</span>
                <span class="materia-estado-badge">${estadoTexto}</span>
            </button>
        `;
    }).join('');

    // Event listeners para cards
    $$('.materia-card').forEach(card => {
        const id = parseInt(card.dataset.id);
        let pressTimer;
        let didLongPress = false;

        // Click normal = cambiar estado (si no es NO_DISPONIBLE)
        card.addEventListener('click', async (e) => {
            if (didLongPress) {
                didLongPress = false;
                return;
            }

            const materia = materias.find(m => m.id === id);
            if (materia.estado === 'NO_DISPONIBLE') {
                // Abrir popup info en vez de cambiar estado
                abrirPopupMateria(materia);
                return;
            }

            const result = await window.api.cambiarEstado(id);
            if (result.success) {
                materias = result.materias;
                renderMaterias();
                actualizarCreditos();
            }
        });

        // Long press = abrir info popup
        card.addEventListener('mousedown', (e) => {
            didLongPress = false;
            pressTimer = setTimeout(() => {
                didLongPress = true;
                const materia = materias.find(m => m.id === id);
                abrirPopupMateria(materia);
            }, 500);
        });

        card.addEventListener('mouseup', () => clearTimeout(pressTimer));
        card.addEventListener('mouseleave', () => clearTimeout(pressTimer));

        // Touch events
        card.addEventListener('touchstart', (e) => {
            didLongPress = false;
            pressTimer = setTimeout(() => {
                didLongPress = true;
                const materia = materias.find(m => m.id === id);
                abrirPopupMateria(materia);
            }, 500);
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            clearTimeout(pressTimer);
            if (didLongPress) {
                e.preventDefault();
            }
        });

        card.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
    });
}

// ═══════════════════════════════════════════════
// POPUP MATERIA
// ═══════════════════════════════════════════════
function abrirPopupMateria(materia) {
    popupMateriaActual = materia;
    popupTabActual = 'previas';
    popupTitulo.textContent = materia.nombre;

    $$('.popup-tab').forEach(t => t.classList.remove('activo'));
    $$('.popup-tab')[0].classList.add('activo');

    renderPopupContenido();
    popupMateria.classList.add('visible');
}

function renderPopupContenido() {
    const m = popupMateriaActual;
    if (!m) return;

    if (popupTabActual === 'previas') {
        let html = '';

        // Previas Aprobadas
        html += '<h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--color-texto-secundario)">Previas Exoneradas</h3>';
        if (m.previasAprobadas && m.previasAprobadas.length > 0) {
            html += '<ul class="popup-lista">';
            m.previasAprobadas.forEach(p => {
                html += `<li>${p.nombre} <small>(${formatEstado(p.estado)})</small></li>`;
            });
            html += '</ul>';
        } else {
            html += '<ul class="popup-lista"><li class="vacia">Ninguna</li></ul>';
        }

        // Previas Curso
        html += '<h3 style="font-size:0.9rem;margin:12px 0 8px;color:var(--color-texto-secundario)">Previas Aprobadas</h3>';
        if (m.previasCurso && m.previasCurso.length > 0) {
            html += '<ul class="popup-lista">';
            m.previasCurso.forEach(p => {
                html += `<li>${p.nombre} <small>(${formatEstado(p.estado)})</small></li>`;
            });
            html += '</ul>';
        } else {
            html += '<ul class="popup-lista"><li class="vacia">Ninguna</li></ul>';
        }

        // Previas No Tener
        if (m.previasNoTener && m.previasNoTener.length > 0) {
            html += '<h3 style="font-size:0.9rem;margin:12px 0 8px;color:var(--color-texto-secundario)">No Tener Exonerada</h3>';
            html += '<ul class="popup-lista">';
            m.previasNoTener.forEach(p => {
                html += `<li>${p.nombre} <small>(${formatEstado(p.estado)})</small></li>`;
            });
            html += '</ul>';
        }

        // Previa créditos
        if (m.previaCreditos) {
            html += '<h3 style="font-size:0.9rem;margin:12px 0 8px;color:var(--color-texto-secundario)">Créditos Requeridos</h3>';
            html += `<ul class="popup-lista"><li>${m.previaCreditos} créditos exonerados</li></ul>`;
        }

        popupContenido.innerHTML = html;
    } else if (popupTabActual === 'habilita') {
        let html = '';

        html += '<h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--color-texto-secundario)">Habilita al Aprobar</h3>';
        if (m.habilitaAlAprobar && m.habilitaAlAprobar.length > 0) {
            html += '<ul class="popup-lista">';
            m.habilitaAlAprobar.forEach(p => {
                html += `<li>${p.nombre}</li>`;
            });
            html += '</ul>';
        } else {
            html += '<ul class="popup-lista"><li class="vacia">Ninguna</li></ul>';
        }

        html += '<h3 style="font-size:0.9rem;margin:12px 0 8px;color:var(--color-texto-secundario)">Habilita al Cursar</h3>';
        if (m.habilitaAlCursar && m.habilitaAlCursar.length > 0) {
            html += '<ul class="popup-lista">';
            m.habilitaAlCursar.forEach(p => {
                html += `<li>${p.nombre}</li>`;
            });
            html += '</ul>';
        } else {
            html += '<ul class="popup-lista"><li class="vacia">Ninguna</li></ul>';
        }

        popupContenido.innerHTML = html;
    } else if (popupTabActual === 'info') {
        const area = areas.find(a => a.id === m.area_id)?.nombre || 'Sin área';
        const perfil = perfiles.find(p => p.id === m.perfil_id)?.nombre || 'General';
        const semestreStr = m.semestre === 'AMBOS' ? 'Ambos' : (m.semestre === '1' ? 'Primer Semestre' : 'Segundo Semestre');

        popupContenido.innerHTML = `
            <div class="popup-info-item">
                <span class="popup-info-label">Estado</span>
                <span>${formatEstado(m.estado)}</span>
            </div>
            <div class="popup-info-item">
                <span class="popup-info-label">Créditos</span>
                <span>${m.creditos}</span>
            </div>
            <div class="popup-info-item">
                <span class="popup-info-label">Semestre</span>
                <span>${semestreStr}</span>
            </div>
            <div class="popup-info-item">
                <span class="popup-info-label">Tipo</span>
                <span>${m.tipo === 'OBLIGATORIA' ? 'Obligatoria' : 'Optativa'}</span>
            </div>
            <div class="popup-info-item">
                <span class="popup-info-label">Área</span>
                <span>${area}</span>
            </div>
            <div class="popup-info-item">
                <span class="popup-info-label">Perfil</span>
                <span>${perfil}</span>
            </div>
        `;
    }
}

function cerrarPopup() {
    popupMateria.classList.remove('visible');
    popupMateriaActual = null;
}

function formatEstado(estado) {
    const map = {
        'APROBADA': 'Exonerada',
        'CURSO': 'Aprobada',
        'DISPONIBLE': 'Disponible',
        'NO_DISPONIBLE': 'No disponible'
    };
    return map[estado] || estado;
}

// ═══════════════════════════════════════════════
// FORMULARIO
// ═══════════════════════════════════════════════
function cargarMultiSelects(excluirId) {
    const materiasDisponibles = materias.filter(m => m.id !== excluirId);

    poblarMultiSelect('select-previas-aprobadas', materiasDisponibles);
    poblarMultiSelect('select-previas-curso', materiasDisponibles);
    poblarMultiSelect('select-previas-no-tener', materiasDisponibles);
}

function poblarMultiSelect(containerId, opciones, seleccionados = []) {
    const container = $(`#${containerId}`);
    const lista = container.querySelector('.multi-select-lista');
    const buscador = container.querySelector('.multi-select-buscar');
    buscador.value = '';

    if (opciones.length === 0) {
        lista.innerHTML = '<div class="multi-select-vacio">No hay materias cargadas</div>';
        return;
    }

    const selIds = seleccionados.map(s => s.id || s);

    lista.innerHTML = opciones.map(m => {
        const checked = selIds.includes(m.id) ? 'checked' : '';
        return `
            <div class="multi-select-item" data-nombre="${m.nombre.toLowerCase()}">
                <input type="checkbox" id="${containerId}-${m.id}" value="${m.id}" ${checked}>
                <label for="${containerId}-${m.id}">${m.nombre}</label>
            </div>
        `;
    }).join('');
}

function filtrarMultiSelect(input) {
    const container = input.closest('.multi-select');
    const items = container.querySelectorAll('.multi-select-item');
    const filtro = input.value.toLowerCase().trim();

    items.forEach(item => {
        const nombre = item.dataset.nombre;
        item.style.display = nombre.includes(filtro) ? 'flex' : 'none';
    });
}

function obtenerSeleccionados(containerId) {
    const checkboxes = $$(`#${containerId} input[type="checkbox"]:checked`);
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

function resetFormulario() {
    formMateriaId.value = '';
    formNombre.value = '';
    formCreditos.value = '';
    formCreditosReq.value = '';
    formSemestre.value = 'AMBOS';
    formTipo.value = 'OBLIGATORIA';
    formArea.value = '';
    formPerfil.value = '';
    formTitulo.textContent = 'Agregar Materia';
    editandoId = null;

    // Reset checkboxes
    $$('.multi-select input[type="checkbox"]').forEach(cb => cb.checked = false);
    $$('.multi-select-buscar').forEach(input => {
        input.value = '';
        filtrarMultiSelect(input);
    });
}

function editarMateria(materia) {
    editandoId = materia.id;
    formMateriaId.value = materia.id;
    formNombre.value = materia.nombre;
    formCreditos.value = materia.creditos;
    formCreditosReq.value = materia.previaCreditos || '';
    formSemestre.value = materia.semestre || 'AMBOS';
    formTipo.value = materia.tipo || 'OBLIGATORIA';
    formArea.value = materia.area_id || '';
    formPerfil.value = materia.perfil_id || '';
    formTitulo.textContent = 'Editar Materia';

    cargarMultiSelects(materia.id);

    // Marcar previas existentes
    setTimeout(() => {
        marcarSeleccionados('select-previas-aprobadas', materia.previasAprobadas);
        marcarSeleccionados('select-previas-curso', materia.previasCurso);
        marcarSeleccionados('select-previas-no-tener', materia.previasNoTener);
    }, 50);

    cambiarVista('formulario');
}

function marcarSeleccionados(containerId, seleccionados) {
    if (!seleccionados || seleccionados.length === 0) return;
    const ids = seleccionados.map(s => s.id || s);

    $$(`#${containerId} input[type="checkbox"]`).forEach(cb => {
        cb.checked = ids.includes(parseInt(cb.value));
    });
}

async function guardarMateria() {
    const nombre = formNombre.value.trim();
    const creditos = parseInt(formCreditos.value) || 0;
    const creditosReq = parseInt(formCreditosReq.value) || 0;
    const semestre = formSemestre.value;
    const tipo = formTipo.value;
    const areaId = parseInt(formArea.value);
    const perfilId = parseInt(formPerfil.value) || null;

    if (!nombre) {
        toast('Ingresá un nombre para la materia', true);
        return;
    }

    if (!areaId) {
        toast('Debés seleccionar un área', true);
        return;
    }

    const datos = {
        nombre,
        creditos,
        semestre,
        tipo,
        areaId,
        perfilId,
        previasAprobadas: obtenerSeleccionados('select-previas-aprobadas'),
        previasCurso: obtenerSeleccionados('select-previas-curso'),
        previasNoTener: obtenerSeleccionados('select-previas-no-tener'),
        creditosRequeridos: creditosReq > 0 ? creditosReq : null
    };

    let result;

    if (editandoId) {
        datos.id = editandoId;
        result = await window.api.editarMateria(datos);
    } else {
        result = await window.api.crearMateria(datos);
    }

    if (result.success) {
        toast(editandoId ? 'Materia actualizada' : 'Materia agregada');
        editandoId = null;
        await cargarMaterias();
        cambiarVista('materias');
    } else {
        toast(result.error || 'Error al guardar', true);
    }
}

// ═══════════════════════════════════════════════
// CONFIRMACION
// ═══════════════════════════════════════════════
function mostrarConfirmacion(titulo, texto, callback) {
    confirmTitulo.textContent = titulo;
    confirmTexto.textContent = texto;
    confirmCallback = callback;
    popupConfirmar.classList.add('visible');
}

function cerrarConfirmacion() {
    popupConfirmar.classList.remove('visible');
    confirmCallback = null;
}

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
function toast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (isError ? ' error' : '');

    // Force reflow
    void toastEl.offsetWidth;
    toastEl.classList.add('visible');

    setTimeout(() => {
        toastEl.classList.remove('visible');
    }, 2500);
}

// ═══════════════════════════════════════════════
// MODO OSCURO
// ═══════════════════════════════════════════════
function initModoOscuro() {
    const guardado = localStorage.getItem('modo-oscuro');
    const preferencia = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const oscuro = guardado === '1' || (guardado === null && preferencia);

    document.body.classList.toggle('modo-oscuro', oscuro);
    $('#toggle-modo-oscuro').checked = oscuro;
}

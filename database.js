const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const fs = require('fs');

let db;

function getDbPath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'materias.db');
}

function initDatabase() {
    const dbPath = getDbPath();

    // Si la base de datos no existe en AppData, intentamos copiar la base de datos por defecto
    if (!fs.existsSync(dbPath)) {
        // En producción, los archivos pueden estar dentro de app.asar o extraResources
        // Buscamos el archivo 'default.sqlite' en la misma carpeta que database.js
        const defaultDbPath = path.join(__dirname, 'default.sqlite');
        
        if (fs.existsSync(defaultDbPath)) {
            try {
                fs.copyFileSync(defaultDbPath, dbPath);
                console.log('Base de datos por defecto copiada exitosamente.');
            } catch (err) {
                console.error('Error al copiar la base de datos por defecto:', err);
            }
        }
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS materias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            creditos INTEGER NOT NULL DEFAULT 0,
            estado TEXT NOT NULL DEFAULT 'NO_DISPONIBLE'
        );

        CREATE TABLE IF NOT EXISTS previas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            materia_id INTEGER NOT NULL,
            previa_id INTEGER,
            tipo TEXT NOT NULL,
            creditos_requeridos INTEGER,
            FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE,
            FOREIGN KEY (previa_id) REFERENCES materias(id) ON DELETE CASCADE
        );
    `);

    return db;
}

function closeDatabase() {
    if (db) db.close();
}

// ─── Materias CRUD ───

function crearMateria(nombre, creditos, previasAprobadas, previasCurso, previasNoTener, creditosRequeridos) {
    const insertMateria = db.prepare(
        'INSERT INTO materias (nombre, creditos, estado) VALUES (?, ?, ?)'
    );
    const insertPrevia = db.prepare(
        'INSERT INTO previas (materia_id, previa_id, tipo, creditos_requeridos) VALUES (?, ?, ?, ?)'
    );

    const transaction = db.transaction(() => {
        const info = insertMateria.run(nombre, creditos, 'NO_DISPONIBLE');
        const materiaId = info.lastInsertRowid;

        // Previas aprobadas
        if (previasAprobadas && previasAprobadas.length > 0) {
            for (const previaId of previasAprobadas) {
                insertPrevia.run(materiaId, previaId, 'APROBADA', null);
            }
        }

        // Previas curso
        if (previasCurso && previasCurso.length > 0) {
            for (const previaId of previasCurso) {
                insertPrevia.run(materiaId, previaId, 'CURSO', null);
            }
        }

        // Previas no tener
        if (previasNoTener && previasNoTener.length > 0) {
            for (const previaId of previasNoTener) {
                insertPrevia.run(materiaId, previaId, 'NO_TENER', null);
            }
        }

        // Previa créditos
        if (creditosRequeridos && creditosRequeridos > 0) {
            insertPrevia.run(materiaId, null, 'CREDITOS', creditosRequeridos);
        }

        return materiaId;
    });

    const materiaId = transaction();
    recalcularEstadoMateria(materiaId);
    return materiaId;
}

function editarMateria(id, nombre, creditos, previasAprobadas, previasCurso, previasNoTener, creditosRequeridos) {
    const updateMateria = db.prepare(
        'UPDATE materias SET nombre = ?, creditos = ? WHERE id = ?'
    );
    const deletePrevias = db.prepare(
        'DELETE FROM previas WHERE materia_id = ?'
    );
    const insertPrevia = db.prepare(
        'INSERT INTO previas (materia_id, previa_id, tipo, creditos_requeridos) VALUES (?, ?, ?, ?)'
    );

    const transaction = db.transaction(() => {
        updateMateria.run(nombre, creditos, id);
        deletePrevias.run(id);

        if (previasAprobadas && previasAprobadas.length > 0) {
            for (const previaId of previasAprobadas) {
                insertPrevia.run(id, previaId, 'APROBADA', null);
            }
        }
        if (previasCurso && previasCurso.length > 0) {
            for (const previaId of previasCurso) {
                insertPrevia.run(id, previaId, 'CURSO', null);
            }
        }
        if (previasNoTener && previasNoTener.length > 0) {
            for (const previaId of previasNoTener) {
                insertPrevia.run(id, previaId, 'NO_TENER', null);
            }
        }
        if (creditosRequeridos && creditosRequeridos > 0) {
            insertPrevia.run(id, null, 'CREDITOS', creditosRequeridos);
        }
    });

    transaction();
    recalcularTodos();
}

function eliminarMateria(id) {
    db.prepare('DELETE FROM materias WHERE id = ?').run(id);
    // Foreign keys ON DELETE CASCADE limpia previas
    // Pero también hay que limpiar previas donde esta materia es previa de otra
    db.prepare('DELETE FROM previas WHERE previa_id = ?').run(id);
    recalcularTodos();
}

function listarMaterias() {
    const materias = db.prepare('SELECT * FROM materias ORDER BY nombre').all();
    for (const materia of materias) {
        materia.previasAprobadas = obtenerPrevias(materia.id, 'APROBADA');
        materia.previasCurso = obtenerPrevias(materia.id, 'CURSO');
        materia.previasNoTener = obtenerPrevias(materia.id, 'NO_TENER');
        materia.previaCreditos = obtenerPreviaCreditos(materia.id);
        materia.habilitaAlAprobar = obtenerHabilita(materia.id, 'APROBADA');
        materia.habilitaAlCursar = obtenerHabilita(materia.id, 'CURSO');
    }
    return materias;
}

function obtenerMateria(id) {
    const materia = db.prepare('SELECT * FROM materias WHERE id = ?').get(id);
    if (!materia) return null;
    materia.previasAprobadas = obtenerPrevias(materia.id, 'APROBADA');
    materia.previasCurso = obtenerPrevias(materia.id, 'CURSO');
    materia.previasNoTener = obtenerPrevias(materia.id, 'NO_TENER');
    materia.previaCreditos = obtenerPreviaCreditos(materia.id);
    materia.habilitaAlAprobar = obtenerHabilita(materia.id, 'APROBADA');
    materia.habilitaAlCursar = obtenerHabilita(materia.id, 'CURSO');
    return materia;
}

function obtenerPrevias(materiaId, tipo) {
    return db.prepare(`
        SELECT m.id, m.nombre, m.estado
        FROM previas p
        JOIN materias m ON p.previa_id = m.id
        WHERE p.materia_id = ? AND p.tipo = ?
    `).all(materiaId, tipo);
}

function obtenerPreviaCreditos(materiaId) {
    const row = db.prepare(
        "SELECT creditos_requeridos FROM previas WHERE materia_id = ? AND tipo = 'CREDITOS'"
    ).get(materiaId);
    return row ? row.creditos_requeridos : null;
}

function obtenerHabilita(materiaId, tipo) {
    return db.prepare(`
        SELECT m.id, m.nombre, m.estado
        FROM previas p
        JOIN materias m ON p.materia_id = m.id
        WHERE p.previa_id = ? AND p.tipo = ?
    `).all(materiaId, tipo);
}

// ─── Estado ───

function cambiarEstado(materiaId) {
    const materia = db.prepare('SELECT estado FROM materias WHERE id = ?').get(materiaId);
    if (!materia || materia.estado === 'NO_DISPONIBLE') return null;

    const ciclo = { 'DISPONIBLE': 'CURSO', 'CURSO': 'APROBADA', 'APROBADA': 'DISPONIBLE' };
    const nuevoEstado = ciclo[materia.estado];

    db.prepare('UPDATE materias SET estado = ? WHERE id = ?').run(nuevoEstado, materiaId);
    recalcularTodos();

    return listarMaterias();
}

function calcularCreditosAprobados() {
    const row = db.prepare(
        "SELECT COALESCE(SUM(creditos), 0) as total FROM materias WHERE estado = 'APROBADA'"
    ).get();
    return row.total;
}

function recalcularEstadoMateria(materiaId) {
    const materia = db.prepare('SELECT * FROM materias WHERE id = ?').get(materiaId);
    if (!materia) return;

    // Si está aprobada o en curso por el usuario, no tocar
    if (materia.estado === 'APROBADA' || materia.estado === 'CURSO') return;

    const disponible = verificarDisponibilidad(materiaId);
    const nuevoEstado = disponible ? 'DISPONIBLE' : 'NO_DISPONIBLE';

    if (materia.estado !== nuevoEstado) {
        db.prepare('UPDATE materias SET estado = ? WHERE id = ?').run(nuevoEstado, materiaId);
    }
}

function verificarDisponibilidad(materiaId) {
    const previas = db.prepare('SELECT * FROM previas WHERE materia_id = ?').all(materiaId);

    // Si no tiene previas, está disponible
    if (previas.length === 0) return true;

    const creditosAprobados = calcularCreditosAprobados();

    for (const previa of previas) {
        if (previa.tipo === 'APROBADA') {
            const estado = db.prepare('SELECT estado FROM materias WHERE id = ?').get(previa.previa_id);
            if (!estado || estado.estado !== 'APROBADA') return false;
        } else if (previa.tipo === 'CURSO') {
            const estado = db.prepare('SELECT estado FROM materias WHERE id = ?').get(previa.previa_id);
            if (!estado || (estado.estado !== 'APROBADA' && estado.estado !== 'CURSO')) return false;
        } else if (previa.tipo === 'NO_TENER') {
            const estado = db.prepare('SELECT estado FROM materias WHERE id = ?').get(previa.previa_id);
            if (estado && estado.estado === 'APROBADA') return false;
        } else if (previa.tipo === 'CREDITOS') {
            if (creditosAprobados < previa.creditos_requeridos) return false;
        }
    }

    return true;
}

function recalcularTodos() {
    const materias = db.prepare('SELECT id, estado FROM materias').all();

    for (const materia of materias) {
        if (materia.estado === 'APROBADA' || materia.estado === 'CURSO') {
            // Verificar si aún debería estar en CURSO (previas pueden haber cambiado)
            // Solo forzar a NO_DISPONIBLE/DISPONIBLE si las previas ya no se cumplen
            // cuando el usuario baja el estado manualmente via el ciclo
            continue;
        }

        const disponible = verificarDisponibilidad(materia.id);
        const nuevoEstado = disponible ? 'DISPONIBLE' : 'NO_DISPONIBLE';

        if (materia.estado !== nuevoEstado) {
            db.prepare('UPDATE materias SET estado = ? WHERE id = ?').run(nuevoEstado, materia.id);
        }
    }
}

function resetearEstados() {
    db.prepare("UPDATE materias SET estado = 'NO_DISPONIBLE'").run();
    recalcularTodos();
    return listarMaterias();
}

module.exports = {
    initDatabase,
    closeDatabase,
    crearMateria,
    editarMateria,
    eliminarMateria,
    listarMaterias,
    obtenerMateria,
    cambiarEstado,
    calcularCreditosAprobados,
    recalcularTodos,
    resetearEstados
};

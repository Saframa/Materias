const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const sourceDb = path.join(__dirname, 'materias.db');
const targetDb = path.join(__dirname, 'default.sqlite');

console.log('Iniciando migración...');

// Copiar la base de datos a default.sqlite para actualizarla
if (fs.existsSync(sourceDb)) {
    fs.copyFileSync(sourceDb, targetDb);
    console.log('✔ Archivo materias.db copiado a default.sqlite.');
} else {
    console.error('❌ No se encontró materias.db en la carpeta actual.');
    process.exit(1);
}

// Conectar a la base de datos copiada
const db = new Database(targetDb);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

try {
    // 1. Asegurar que las nuevas tablas existen
    db.exec(`
        CREATE TABLE IF NOT EXISTS areas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS perfiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        );
    `);
    console.log('✔ Tablas áreas y perfiles verificadas/creadas.');

    // 2. Comprobar si las columnas nuevas ya existen en materias
    const columns = db.prepare("PRAGMA table_info(materias)").all();
    const hasArea = columns.some(c => c.name === 'area_id');
    
    if (!hasArea) {
        // 3. Añadir las columnas nuevas
        db.exec(`
            ALTER TABLE materias ADD COLUMN semestre TEXT DEFAULT 'AMBOS';
            ALTER TABLE materias ADD COLUMN tipo TEXT DEFAULT 'OBLIGATORIA';
            ALTER TABLE materias ADD COLUMN area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL;
            ALTER TABLE materias ADD COLUMN perfil_id INTEGER REFERENCES perfiles(id) ON DELETE SET NULL;
        `);
        console.log('✔ Columnas semestre, tipo, area_id, perfil_id agregadas a la tabla materias.');
    } else {
        console.log('ℹ Las columnas ya existen en la tabla materias.');
    }

    // 4. Crear un Área Dummy y asignarla a todas las materias
    const info = db.prepare("INSERT OR IGNORE INTO areas (nombre) VALUES ('Área Pendiente')").run();
    const areaDummyId = info.lastInsertRowid || db.prepare("SELECT id FROM areas WHERE nombre = 'Área Pendiente'").get().id;
    
    // Actualizar todas las materias para que tengan los datos dummy por defecto
    const updateResult = db.prepare(`
        UPDATE materias 
        SET area_id = ?, 
            semestre = 'AMBOS', 
            tipo = 'OBLIGATORIA', 
            perfil_id = NULL 
        WHERE area_id IS NULL
    `).run(areaDummyId);

    console.log(`✔ Se asignó el área dummy 'Área Pendiente' a ${updateResult.changes} materias.`);

    console.log('✨ Migración completada exitosamente.');
} catch (error) {
    console.error('❌ Error durante la migración:', error);
} finally {
    db.close();
}

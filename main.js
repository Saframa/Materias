const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const database = require('./database');

// Redirigir cache de GPU fuera de OneDrive para evitar errores de permisos
app.commandLine.appendSwitch('disk-cache-dir', path.join(app.getPath('userData'), 'cache'));
app.commandLine.appendSwitch('gpu-cache-dir', path.join(app.getPath('userData'), 'gpu-cache'));

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        minWidth: 400,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, 'renderer', 'icon.png'),
        title: 'Materias - Ingeniería Civil',
        autoHideMenuBar: true,
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
    database.initDatabase();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    database.closeDatabase();
    if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Handlers ───

ipcMain.handle('materia:crear', (event, datos) => {
    try {
        const id = database.crearMateria(
            datos.nombre,
            datos.creditos,
            datos.previasAprobadas,
            datos.previasCurso,
            datos.previasNoTener,
            datos.creditosRequeridos,
            datos.semestre,
            datos.tipo,
            datos.areaId,
            datos.perfilId
        );
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('materia:editar', (event, datos) => {
    try {
        database.editarMateria(
            datos.id,
            datos.nombre,
            datos.creditos,
            datos.previasAprobadas,
            datos.previasCurso,
            datos.previasNoTener,
            datos.creditosRequeridos,
            datos.semestre,
            datos.tipo,
            datos.areaId,
            datos.perfilId
        );
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('materia:eliminar', (event, id) => {
    try {
        database.eliminarMateria(id);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('materia:listar', () => {
    try {
        return { success: true, materias: database.listarMaterias() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('materia:obtener', (event, id) => {
    try {
        const materia = database.obtenerMateria(id);
        return { success: true, materia };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('estado:cambiar', (event, id) => {
    try {
        const materias = database.cambiarEstado(id);
        return { success: true, materias };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('creditos:calcular', () => {
    try {
        const total = database.calcularCreditosAprobados();
        return { success: true, total };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('estado:resetear', () => {
    try {
        const materias = database.resetearEstados();
        return { success: true, materias };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('area:crear', (event, nombre) => {
    try {
        const id = database.crearArea(nombre);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('area:listar', () => {
    try {
        return { success: true, areas: database.listarAreas() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('perfil:crear', (event, nombre) => {
    try {
        const id = database.crearPerfil(nombre);
        return { success: true, id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('perfil:listar', () => {
    try {
        return { success: true, perfiles: database.listarPerfiles() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('creditos:porArea', () => {
    try {
        return { success: true, desglose: database.calcularCreditosPorArea() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

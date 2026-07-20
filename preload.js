const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Materias
    crearMateria: (datos) => ipcRenderer.invoke('materia:crear', datos),
    editarMateria: (datos) => ipcRenderer.invoke('materia:editar', datos),
    eliminarMateria: (id) => ipcRenderer.invoke('materia:eliminar', id),
    listarMaterias: () => ipcRenderer.invoke('materia:listar'),
    obtenerMateria: (id) => ipcRenderer.invoke('materia:obtener', id),

    // Estado
    cambiarEstado: (id) => ipcRenderer.invoke('estado:cambiar', id),
    calcularCreditos: () => ipcRenderer.invoke('creditos:calcular'),
    resetearEstados: () => ipcRenderer.invoke('estado:resetear'),

    // Áreas
    crearArea: (nombre) => ipcRenderer.invoke('area:crear', nombre),
    listarAreas: () => ipcRenderer.invoke('area:listar'),
    calcularCreditosPorArea: () => ipcRenderer.invoke('creditos:porArea'),

    // Perfiles
    crearPerfil: (nombre) => ipcRenderer.invoke('perfil:crear', nombre),
    listarPerfiles: () => ipcRenderer.invoke('perfil:listar'),
});

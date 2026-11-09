package com.devmap.exception;

public class ProjectStorageException extends RuntimeException {
    public ProjectStorageException() {
        super("No se pudo actualizar el almacenamiento local de mapas. Comprueba los permisos y el espacio disponible.");
    }
}

-- Seleccionar la base de datos
USE proyectoarduino;

-- Crear la tabla usuarios
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    uuid VARCHAR(255)
);

-- Crear la tabla taller
CREATE TABLE taller (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
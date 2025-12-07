// Importa las librerías necesarias
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Configuración básica
const app = express();
const server = http.createServer(app);
const io = new Server(server); 
const PORT = process.env.PORT || 3000; 

// Middleware para servir los archivos estáticos (HTML, CSS, JS) desde la carpeta 'public'
app.use(express.static('public'));

// ----------------------------------------------------
// Lógica de Juego de Bingo y Salas
// ----------------------------------------------------

// Objeto para almacenar todas las salas de juego activas
const rooms = {}; 

/**
 * Inicializa un nuevo juego de bingo para una sala.
 * @param {string} roomName - El nombre de la sala (ej. 'room-3-players')
 */
function initializeGame(roomName) {
    console.log(`[GAME] Inicializando juego para la sala: ${roomName}`);
    rooms[roomName].numbersCalled = []; // Números que ya se han cantado
    rooms[roomName].availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1); // Números del 1 al 75
    rooms[roomName].gameStarted = true;
    rooms[roomName].currentNumber = null;
    
    // Notificar a todos los jugadores que el juego comienza
    io.to(roomName).emit('gameStart', '¡El juego de Bingo ha comenzado!');
    
    // Iniciar el temporizador para el canto de números
    startCallingNumbers(roomName);
}

/**
 * Canta un número aleatorio y lo notifica a la sala.
 * @param {string} roomName 
 */
function callNextNumber(roomName) {
    const room = rooms[roomName];
    if (!room || room.availableNumbers.length === 0) {
        // Fin del juego o sala no válida
        clearInterval(room.intervalId);
        io.to(roomName).emit('gameOver', 'Todos los números han sido cantados.');
        return;
    }

    // 1. Seleccionar un número aleatorio de los disponibles
    const randomIndex = Math.floor(Math.random() * room.availableNumbers.length);
    const newNumber = room.availableNumbers.splice(randomIndex, 1)[0]; // Saca el número de la lista
    
    room.numbersCalled.push(newNumber);
    room.currentNumber = newNumber;
    
    // 2. Notificar a todos los jugadores en la sala
    io.to(roomName).emit('newNumber', newNumber);
    console.log(`[CALL] Sala ${roomName}: Cantado el número ${newNumber}. Quedan ${room.availableNumbers.length}`);
}

/**
 * Establece el intervalo para el canto de números.
 * @param {string} roomName 
 */
function startCallingNumbers(roomName) {
    // Canta un nuevo número cada 5 segundos (ajustable)
    const intervalId = setInterval(() => callNextNumber(roomName), 5000); 
    rooms[roomName].intervalId = intervalId;
}

/**
 * Lógica para verificar si un jugador realmente hizo BINGO.
 * Esta es una verificación simple y se puede hacer más compleja.
 * @param {string} roomName 
 * @param {Array<number>} markedNumbers - Números que el jugador marcó en su cartón.
 * @returns {boolean} True si es un BINGO válido.
 */
function validateBingo(roomName, markedNumbers) {
    const room = rooms[roomName];
    if (!room) return false;

    // Se asume que el jugador marcó correctamente los números que salieron.
    // Para simplificar, verificamos que tenga al menos 5 números válidos marcados.
    
    // 1. Verificar que TODOS los números marcados realmente hayan sido cantados
    const allValid = markedNumbers.every(num => room.numbersCalled.includes(num));

    if (!allValid) {
        console.log(`[BINGO CHECK] Bingo inválido: El jugador marcó números que aún no han salido.`);
        return false;
    }
    
    // Lógica avanzada aquí (verificar si los 5 números forman una línea, columna o diagonal).
    // Para este ejemplo, solo confirmaremos que marcó al menos 5 números válidos.
    if (markedNumbers.length >= 5) {
        // En una implementación real, se debe verificar el patrón (línea, columna, etc.)
        return true; 
    }

    return false;
}


// ----------------------------------------------------
// Lógica de Socket.io (Manejo de jugadores y eventos)
// ----------------------------------------------------

io.on('connection', (socket) => {
    console.log(`[CONNECT] Un usuario se ha conectado: ${socket.id}`);

    // Manejar la unión a una sala
    socket.on('joinRoom', (players) => {
        const maxPlayers = parseInt(players);
        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 5) return;

        const roomName = `room-${maxPlayers}-players`;
        
        // Inicializar la sala si no existe
        if (!rooms[roomName]) {
            rooms[roomName] = { 
                max: maxPlayers, 
                players: new Set(), 
                gameStarted: false, 
                numbersCalled: [],
                availableNumbers: [],
                intervalId: null
            };
        }

        const room = rooms[roomName];

        if (room.players.size < room.max && !room.gameStarted) {
            socket.join(roomName);
            room.players.add(socket.id);
            socket.data.room = roomName; // Guardar la sala en la data del socket
            
            const currentPlayers = room.players.size;
            
            console.log(`[JOIN] Usuario ${socket.id} se unió a ${roomName}. (${currentPlayers}/${room.max})`);
            
            // Notificar al jugador que se ha unido y el estado actual de la sala
            socket.emit('joined', {
                roomName: roomName,
                players: currentPlayers,
                max: room.max,
                numbersCalled: room.numbersCalled 
            });

            // Notificar a todos en la sala sobre el nuevo jugador
            io.to(roomName).emit('playerUpdate', { players: currentPlayers, max: room.max });

            // Iniciar el juego si la sala está llena
            if (currentPlayers === room.max) {
                initializeGame(roomName);
            }
        } else {
            socket.emit('error', 'La sala está llena o el juego ya ha comenzado.');
        }
    });


    // Manejar cuando un jugador grita BINGO
    socket.on('playerBingo', (data) => {
        const roomName = socket.data.room;
        if (!roomName) return;

        const isValid = validateBingo(roomName, data.markedNumbers);

        if (isValid) {
            // Detener el canto de números
            clearInterval(rooms[roomName].intervalId); 
            // Notificar al ganador
            socket.emit('bingoResult', { success: true });
            // Notificar al resto de la sala que el juego terminó
            socket.to(roomName).emit('gameOver', `¡${socket.id} ha gritado BINGO y ha ganado!`);
            
            // Lógica para reiniciar la sala o eliminarla (futuro)
            delete rooms[roomName];

        } else {
            // BINGO FALSO
            socket.emit('bingoResult', { success: false, lastNumber: rooms[roomName].currentNumber });
            // Opcional: Notificar a la sala que hubo un bingo falso (para generar emoción)
            socket.to(roomName).emit('statusMessage', `¡Un jugador gritó BINGO, pero fue falso! Sigue jugando.`);
        }
    });

    // Manejar desconexiones
    socket.on('disconnect', () => {
        const roomName = socket.data.room;
        if (roomName && rooms[roomName]) {
            rooms[roomName].players.delete(socket.id);
            const currentPlayers = rooms[roomName].players.size;

            console.log(`[DISCONNECT] Usuario ${socket.id} se desconectó de ${roomName}. Jugadores restantes: ${currentPlayers}`);

            // Si el juego estaba en curso y la sala se vacía, detener el juego
            if (rooms[roomName].gameStarted && currentPlayers === 0) {
                clearInterval(rooms[roomName].intervalId);
                delete rooms[roomName];
                console.log(`[CLEANUP] Sala ${roomName} vacía, juego detenido.`);
            } else if (rooms[roomName]) {
                 // Notificar a los jugadores restantes
                io.to(roomName).emit('playerUpdate', { players: currentPlayers, max: rooms[roomName].max });
            }
        }
        console.log(`[DISCONNECT] Un usuario se ha desconectado: ${socket.id}`);
    });
});

// ----------------------------------------------------
// Iniciar el Servidor
// ----------------------------------------------------

server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
    console.log('Ahora puedes abrir http://localhost:3000 en tu navegador (si estás en local)');
});

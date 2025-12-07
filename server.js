// Importa las librerías necesarias
const express = require('express');
const http = require('http');
// Asegúrate de que la 'S' en Server sea MAYÚSCULA.
const { Server } = require('socket.io'); 

// Configuración básica
const app = express();
const server = http.createServer(app);
const io = new Server(server); 
// Usa el puerto que el servidor de hosting (Render) le asigne (process.env.PORT) o el 3000 local.
const PORT = process.env.PORT || 3000; 

// Middleware para servir los archivos estáticos (HTML, CSS, JS) desde la carpeta 'public'
app.use(express.static('public'));

// ----------------------------------------------------
// Lógica de Juego de Bingo y Salas
// ----------------------------------------------------

// Objeto para almacenar todas las salas de juego activas
const rooms = {}; 

function initializeGame(roomName) {
    console.log(`[GAME] Inicializando juego para la sala: ${roomName}`);
    const maxPlayers = rooms[roomName].max;
    
    rooms[roomName].numbersCalled = []; 
    // Crea un array con números del 1 al 75
    rooms[roomName].availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1); 
    rooms[roomName].gameStarted = true;
    rooms[roomName].currentNumber = null;
    
    io.to(roomName).emit('gameStart', `¡El juego de Bingo ha comenzado en la sala de ${maxPlayers}!`);
    
    // Empieza a cantar números 2 segundos después de iniciar
    setTimeout(() => startCallingNumbers(roomName), 2000);
}

function callNextNumber(roomName) {
    const room = rooms[roomName];
    if (!room || room.availableNumbers.length === 0) {
        clearInterval(room.intervalId);
        io.to(roomName).emit('gameOver', 'Todos los números han sido cantados. Fin del juego.');
        return;
    }

    // Selecciona un número al azar de los disponibles
    const randomIndex = Math.floor(Math.random() * room.availableNumbers.length);
    const newNumber = room.availableNumbers.splice(randomIndex, 1)[0]; 
    
    room.numbersCalled.push(newNumber);
    room.currentNumber = newNumber;
    
    io.to(roomName).emit('newNumber', newNumber);
    console.log(`[CALL] Sala ${roomName}: Cantado el número ${newNumber}.`);
}

function startCallingNumbers(roomName) {
    // Canta un nuevo número cada 5 segundos
    const intervalId = setInterval(() => callNextNumber(roomName), 5000); 
    rooms[roomName].intervalId = intervalId;
}

function validateBingo(roomName, markedNumbers) {
    const room = rooms[roomName];
    if (!room) return false;

    // Verificar que TODOS los números marcados realmente hayan sido cantados
    const allValid = markedNumbers.every(num => room.numbersCalled.includes(num));

    if (!allValid) {
        return false;
    }
    
    // Simplificado: si tiene 5 números válidos marcados, se asume un Bingo.
    if (markedNumbers.length >= 5) {
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
            socket.data.room = roomName; 
            
            const currentPlayers = room.players.size;
            
            console.log(`[JOIN] Usuario ${socket.id} se unió a ${roomName}. (${currentPlayers}/${room.max})`);
            
            socket.emit('joined', {
                roomName: roomName,
                players: currentPlayers,
                max: room.max,
                numbersCalled: room.numbersCalled 
            });

            io.to(roomName).emit('playerUpdate', { players: currentPlayers, max: room.max });

            // Iniciar el juego si la sala está llena (Línea crítica: ~173)
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
            clearInterval(rooms[roomName].intervalId); 
            io.to(roomName).emit('gameOver', `¡${socket.id} ha gritado BINGO y ha ganado!`);
            
            delete rooms[roomName];

        } else {
            socket.emit('bingoResult', { success: false, lastNumber: rooms[roomName] ? rooms[roomName].currentNumber : null });
            socket.to(roomName).emit('statusMessage', `¡Un jugador gritó BINGO, pero fue falso! Sigue jugando.`);
        }
    });

    // Manejar desconexiones
    socket.on('disconnect', () => {
        const roomName = socket.data.room;
        if (roomName && rooms[roomName]) {
            rooms[roomName].players.delete(socket.id);
            const currentPlayers = rooms[roomName].players.size;

            if (rooms[roomName].gameStarted && currentPlayers === 0) {
                clearInterval(rooms[roomName].intervalId);
                delete rooms[roomName];
            } else if (rooms[roomName]) {
                io.to(roomName).emit('playerUpdate', { players: currentPlayers, max: rooms[roomName].max });
            }
        }
    });
});

// ----------------------------------------------------
// Iniciar el Servidor (Sintaxis corregida en inglés)
// ----------------------------------------------------

server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});

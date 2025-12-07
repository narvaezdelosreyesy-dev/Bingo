// Conectar con el servidor
const socket = io();

// -------------------------------------
// Variables del juego
// -------------------------------------
let myRoom = null;
let myMarkedNumbers = [];
let maxPlayers = 0;
let currentPlayers = 0;

// -------------------------------------
// Unirse a una sala
// -------------------------------------
function joinRoom(players) {
    socket.emit('joinRoom', players);
}

// -------------------------------------
// Eventos del servidor
// -------------------------------------

// Cuando se une exitosamente a la sala
socket.on('joined', (data) => {
    myRoom = data.roomName;
    currentPlayers = data.players;
    maxPlayers = data.max;

    console.log(`Te uniste a la sala: ${myRoom} (${currentPlayers}/${maxPlayers})`);
    updatePlayerInfo();
});

// Actualización de jugadores
socket.on('playerUpdate', (data) => {
    currentPlayers = data.players;
    maxPlayers = data.max;
    updatePlayerInfo();
});

// Inicio del juego
socket.on('gameStart', (message) => {
    console.log(message);
    alert(message); // Mensaje de inicio
});

// Nuevo número cantado
socket.on('newNumber', (number) => {
    console.log(`Número cantado: ${number}`);
    displayNumber(number);
});

// Juego terminado
socket.on('gameOver', (message) => {
    console.log(message);
    alert(message);
});

// Resultado de BINGO falso
socket.on('bingoResult', (data) => {
    if (!data.success) {
        alert(`BINGO falso! Último número: ${data.lastNumber}`);
    }
});

socket.on('statusMessage', (msg) => {
    console.log(msg);
});

// Error al intentar unirse
socket.on('error', (msg) => {
    alert(msg);
});

// -------------------------------------
// Funciones de interacción
// -------------------------------------

// Marcar un número como tuyo
function markNumber(number) {
    if (!myMarkedNumbers.includes(number)) {
        myMarkedNumbers.push(number);
        console.log(`Marcaste el número: ${number}`);
    }
}

// Gritar BINGO
function shoutBingo() {
    if (!myRoom) {
        alert("No estás en una sala aún!");
        return;
    }

    socket.emit('playerBingo', {
        markedNumbers: myMarkedNumbers
    });
}

// Mostrar número cantado en pantalla
function displayNumber(number) {
    const numbersDiv = document.getElementById('numbers');
    if (numbersDiv) {
        const span = document.createElement('span');
        span.textContent = number + " ";
        numbersDiv.appendChild(span);
    }
}

// Actualizar info de jugadores
function updatePlayerInfo() {
    const infoDiv = document.getElementById('playerInfo');
    if (infoDiv) {
        infoDiv.textContent = `Jugadores: ${currentPlayers}/${maxPlayers}`;
    }
}

// -------------------------------------
// Inicialización simple
// -------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Botones del HTML
    const joinBtn = document.getElementById('joinBtn');
    const bingoBtn = document.getElementById('bingoBtn');
    const markInput = document.getElementById('markInput');
    const markBtn = document.getElementById('markBtn');

    joinBtn.addEventListener('click', () => {
        const players = parseInt(document.getElementById('playersInput').value);
        joinRoom(players);
    });

    bingoBtn.addEventListener('click', shoutBingo);

    markBtn.addEventListener('click', () => {
        const num = parseInt(markInput.value);
        if (!isNaN(num)) markNumber(num);
        markInput.value = '';
    });
});

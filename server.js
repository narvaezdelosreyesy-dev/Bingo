// **¡IMPORTANTE!** Reemplaza esta URL con la dirección HTTPS que Render le asignó a tu servicio web.
const RENDER_URL = "https://bingo-sd6t.onrender.com"; 

// Conexión específica a la URL de Render
const socket = io(RENDER_URL, { transports: ['websocket', 'polling'] }); 

// Referencias a los elementos del DOM
const roomSelection = document.getElementById('room-selection');
const gameArea = document.getElementById('game-area');
const bingoCardContainer = document.getElementById('bingo-card');
const roomButtons = document.querySelectorAll('.room-btn');
const callBingoButton = document.getElementById('call-bingo');
const calledNumberDisplay = document.getElementById('called-number');
const statusMessage = document.getElementById('game-info'); // Usaremos esto para mensajes de estado

// Variable global para almacenar los números cantados
let calledNumbers = new Set(); 
let myCardNumbers = {};
let currentRoom = '';

// --- 1. Lógica del Cartón de Bingo ---

function generateBingoCard() {
    // Definición de rangos estándar de B-I-N-G-O (1-15, 16-30, etc.)
    const ranges = {
        'B': [1, 15], 'I': [16, 30], 'N': [31, 45], 'G': [46, 60], 'O': [61, 75]
    };
    const columns = ['B', 'I', 'N', 'G', 'O'];
    myCardNumbers = {}; 
    
    // 1. Llenar el objeto myCardNumbers con 5 números únicos por columna
    columns.forEach(col => {
        const [min, max] = ranges[col];
        const colNumbers = new Set();
        while (colNumbers.size < 5) {
            const num = Math.floor(Math.random() * (max - min + 1)) + min;
            colNumbers.add(num);
        }
        myCardNumbers[col] = Array.from(colNumbers).sort((a, b) => a - b);
    });

    // 2. Renderizar el cartón en HTML
    bingoCardContainer.innerHTML = ''; 

    // A. Añadir encabezados B-I-N-G-O
    columns.forEach(col => {
        const headerCell = document.createElement('div');
        headerCell.className = 'card-cell';
        headerCell.textContent = col;
        bingoCardContainer.appendChild(headerCell);
    });

    // B. Añadir los números del cartón
    for (let row = 0; row < 5; row++) {
        columns.forEach((col) => {
            const cell = document.createElement('div');
            cell.className = 'card-cell';

            if (col === 'N' && row === 2) {
                // Celda central: 'Free' o 'Libre'
                cell.textContent = 'LIBRE';
                cell.classList.add('marked'); 
                cell.dataset.number = '0';
                cell.dataset.column = 'N';
            } else {
                const number = myCardNumbers[col][row];
                cell.textContent = number;
                cell.dataset.number = number;
                cell.dataset.column = col;
                cell.addEventListener('click', markNumber); 
                
                // Si el número ya ha sido cantado (ej. por reconexión), márcalo
                if (calledNumbers.has(number)) {
                    cell.classList.add('marked');
                }
            }
            bingoCardContainer.appendChild(cell);
        });
    }
}

// Función para marcar/desmarcar un número en el cartón (solo si ha sido cantado)
function markNumber(event) {
    const cell = event.target;
    const number = parseInt(cell.dataset.number);

    // Solo permite marcar si el número ha sido cantado por el servidor
    if (calledNumbers.has(number)) {
        cell.classList.toggle('marked');
        checkPossibleBingo(); 
    } else {
        // En un juego real, esto no debería ocurrir si el jugador es honesto.
        statusMessage.textContent = `¡El número ${number} aún no ha sido cantado!`;
    }
}

// Lógica básica para verificar si el jugador tiene un bingo y habilitar el botón
function checkPossibleBingo() {
    const markedCells = document.querySelectorAll('.card-cell.marked');
    
    // Si tienes al menos 5 marcados (incluyendo el 'LIBRE')
    if (markedCells.length >= 5) { 
        callBingoButton.disabled = false;
        callBingoButton.textContent = "¡BINGO LISTO!";
    } else {
        callBingoButton.disabled = true;
        callBingoButton.textContent = "¡BINGO!";
    }
}


// --- 2. Lógica de Socket.io (Conexión al Servidor) ---

roomButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const players = event.target.dataset.players;
        
        // 1. Conectarse al servidor pidiendo la sala
        socket.emit('joinRoom', players);
        
        // 2. Ocultar la selección de sala y mostrar el área de juego
        roomSelection.style.display = 'none';
        gameArea.style.display = 'block';
        statusMessage.textContent = `Uniéndose a la sala de ${players} jugadores...`;
    });
});

// Evento que se dispara cuando el servidor confirma que entraste a la sala
socket.on('joined', (data) => {
    currentRoom = data.roomName;
    
    // Generar un cartón de bingo al unirse
    generateBingoCard();
    
    // Actualizar el estado con números ya cantados (si los hay)
    if (data.numbersCalled && data.numbersCalled.length > 0) {
        data.numbersCalled.forEach(num => calledNumbers.add(num));
        statusMessage.textContent = `Te uniste a una partida en curso. El último número cantado es ${data.numbersCalled[data.numbersCalled.length - 1]}.`;
    } else {
        statusMessage.textContent = `Conectado a la sala. Esperando ${data.max - data.players} jugadores más.`;
    }
});

// Evento que se dispara cuando el servidor canta un nuevo número
socket.on('newNumber', (number) => {
    calledNumbers.add(number); 
    calledNumberDisplay.textContent = number; 
    statusMessage.textContent = `¡Número Cantado: ${number}!`;

    // Marcar el número si existe en el cartón
    const cellToMark = document.querySelector(`.card-cell[data-number="${number}"]`);
    if (cellToMark && !cellToMark.classList.contains('marked')) {
        cellToMark.classList.add('marked');
        checkPossibleBingo(); 
    }
});

// Evento que notifica cuando la sala está llena y el juego comienza
socket.on('gameStart', (message) => {
    statusMessage.textContent = message;
});


// Evento que se dispara al hacer clic en el botón "¡BINGO!"
callBingoButton.addEventListener('click', () => {
    callBingoButton.disabled = true;
    callBingoButton.textContent = "Verificando...";
    
    // Recolectar solo los números que están marcados y que no sean la celda 'LIBRE'
    const markedNumbers = Array.from(document.querySelectorAll('.card-cell.marked'))
        .map(cell => parseInt(cell.dataset.number))
        .filter(num => num !== 0); 

    // Enviar los números marcados al servidor para validación
    socket.emit('playerBingo', {
        room: currentRoom,
        markedNumbers: markedNumbers
    });
});

// Evento que se dispara cuando el servidor responde a la llamada de BINGO
socket.on('bingoResult', (result) => {
    if (result.success) {
        alert(`¡BINGO VERIFICADO! ¡Ganaste! El juego ha terminado.`);
        // Recargar la página para volver a la selección de sala
        window.location.reload(); 
    } else {
        alert(`BINGO FALSO. ¡Sigue jugando!`);
        statusMessage.textContent = `¡Bingo Falso! El último número cantado fue ${result.lastNumber}.`;
        callBingoButton.disabled = false;
        callBingoButton.textContent = "¡BINGO LISTO!";
    }
});

// Evento para mensajes de estado general (ej. alguien se une, alguien se va)
socket.on('playerUpdate', (data) => {
    if (data.players < data.max) {
        statusMessage.textContent = `Esperando ${data.max - data.players} jugadores más...`;
    }
});

socket.on('gameOver', (message) => {
    statusMessage.textContent = message;
    alert(message);
    window.location.reload();
});


// Inicializar: asegurarse de que el área de juego esté oculta al cargar
document.addEventListener('DOMContentLoaded', () => {
    gameArea.style.display = 'none';
});

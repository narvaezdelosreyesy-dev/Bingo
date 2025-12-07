// Referencias a los elementos del DOM
const roomSelection = document.getElementById('room-selection');
const gameArea = document.getElementById('game-area');
const bingoCardContainer = document.getElementById('bingo-card');
const roomButtons = document.querySelectorAll('.room-btn');

// --- 1. Lógica del Cartón de Bingo ---

// Genera un cartón de Bingo estándar (5x5)
function generateBingoCard() {
    // Definición de rangos estándar de B-I-N-G-O (1-15, 16-30, etc.)
    const ranges = {
        'B': [1, 15],
        'I': [16, 30],
        'N': [31, 45],
        'G': [46, 60],
        'O': [61, 75]
    };
    const columns = ['B', 'I', 'N', 'G', 'O'];
    const cardNumbers = {};

    // 1. Llenar el objeto cardNumbers con 5 números únicos por columna
    columns.forEach(col => {
        const [min, max] = ranges[col];
        const colNumbers = new Set();
        while (colNumbers.size < 5) {
            // Genera un número aleatorio dentro del rango de la columna
            const num = Math.floor(Math.random() * (max - min + 1)) + min;
            colNumbers.add(num);
        }
        cardNumbers[col] = Array.from(colNumbers).sort((a, b) => a - b);
    });

    // 2. Renderizar el cartón en HTML
    bingoCardContainer.innerHTML = ''; // Limpiar cualquier contenido previo

    // A. Añadir encabezados B-I-N-G-O
    columns.forEach(col => {
        const headerCell = document.createElement('div');
        headerCell.className = 'card-cell';
        headerCell.textContent = col;
        bingoCardContainer.appendChild(headerCell);
    });

    // B. Añadir los números del cartón
    for (let row = 0; row < 5; row++) {
        columns.forEach((col, colIndex) => {
            const cell = document.createElement('div');
            cell.className = 'card-cell';

            if (col === 'N' && row === 2) {
                // Celda central: 'Free' o 'Libre'
                cell.textContent = 'LIBRE';
                cell.classList.add('marked'); // Marca la celda central automáticamente
                cell.dataset.number = '0';
            } else {
                // Asigna el número generado
                const number = cardNumbers[col][row];
                cell.textContent = number;
                cell.dataset.number = number;
                cell.addEventListener('click', markNumber); // Añadir evento para marcar
            }
            bingoCardContainer.appendChild(cell);
        });
    }
}

// Función para marcar/desmarcar un número en el cartón (solo visualmente por ahora)
function markNumber(event) {
    const cell = event.target;
    // La lógica de marcaje se debe validar en el servidor, 
    // pero por ahora solo se permite marcar visualmente.
    if (cell.textContent !== 'LIBRE') {
        cell.classList.toggle('marked');
    }
}

// --- 2. Lógica de Selección de Sala ---

roomButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const players = event.target.dataset.players;
        
        // **ESTO ES TEMPORAL:** En el futuro, aquí se hará una 
        // conexión a la sala real usando WebSockets (Socket.io).
        console.log(`Intentando entrar a sala de ${players} jugadores...`);

        // Generar un cartón de bingo al iniciar el juego
        generateBingoCard();
        
        // Ocultar la selección de sala y mostrar el área de juego
        roomSelection.style.display = 'none';
        gameArea.style.display = 'block';
        
        // En un juego real, la conexión al servidor iría aquí:
        // connectToServer(players); 
    });
});

// Inicializar: asegurarse de que el área de juego esté oculta al cargar
document.addEventListener('DOMContentLoaded', () => {
    gameArea.style.display = 'none';
});

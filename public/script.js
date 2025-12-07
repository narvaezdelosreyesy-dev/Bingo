// Generar un cartón de 25 números aleatorios del 1 al 75
function generateBingoCard() {
    const cardDiv = document.getElementById('bingo-card');
    cardDiv.innerHTML = ''; // Limpiar cualquier número previo

    const numbersSet = new Set();
    while (numbersSet.size < 25) {
        numbersSet.add(Math.floor(Math.random() * 75) + 1);
    }

    numbersSet.forEach(num => {
        const span = document.createElement('span');
        span.textContent = num;
        span.classList.add('card-number');
        span.dataset.number = num;

        // Permitir marcar número haciendo click
        span.addEventListener('click', () => {
            markNumber(num);
            span.classList.add('marked-number'); // Cambiar color
        });

        cardDiv.appendChild(span);
    });
}

// Mostrar un número cantado y resaltarlo en el cartón si está
function displayNumber(number) {
    // Mostrar en la lista de números cantados
    const numbersDiv = document.getElementById('numbers');
    if (numbersDiv) {
        const span = document.createElement('span');
        span.textContent = number + " ";
        span.classList.add('called-number');
        numbersDiv.appendChild(span);
    }

    // Mostrar el último número cantado
    const lastNumberSpan = document.getElementById('called-number');
    if (lastNumberSpan) lastNumberSpan.textContent = number;

    // Resaltar en el cartón si existe
    const cardNumbers = document.querySelectorAll('#bingo-card .card-number');
    cardNumbers.forEach(span => {
        if (parseInt(span.dataset.number) === number) {
            span.classList.add('highlight-number');
        }
    });
}

// Generar el cartón cuando se une a la sala
function joinRoom(players) {
    socket.emit('joinRoom', players);
    generateBingoCard(); // Genera tu cartón al entrar
}

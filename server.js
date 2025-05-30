const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const board = Array(9).fill(null); // 0..8 cells
let players = {}; // socket.id -> 'X' or 'O'
let turn = 'X';

function checkWin(symbol) {
  const combos = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  return combos.some(c => c.every(i => board[i] === symbol));
}

function checkTie() {
  return board.every(cell => cell !== null);
}

io.on('connection', (socket) => {
  // assign symbol
  const symbols = ['X','O'];
  const taken = Object.values(players);
  const available = symbols.find(s => !taken.includes(s));
  if (!available) {
    socket.emit('full');
    socket.disconnect(true);
    return;
  }
  players[socket.id] = available;

  socket.emit('init', { symbol: available, board, turn });
  socket.broadcast.emit('message', `Player ${available} joined.`);

  socket.on('move', (index) => {
    const symbol = players[socket.id];
    if (symbol !== turn || board[index] !== null) return;
    board[index] = symbol;
    if (checkWin(symbol)) {
      io.emit('state', { board, turn: null, winner: symbol });
      return;
    }
    if (checkTie()) {
      io.emit('state', { board, turn: null, winner: 'Tie' });
      return;
    }
    turn = symbol === 'X' ? 'O' : 'X';
    io.emit('state', { board, turn });
  });

  socket.on('disconnect', () => {
    const symbol = players[socket.id];
    delete players[socket.id];
    socket.broadcast.emit('message', `Player ${symbol} left.`);
    // reset game if no players remain
    if (Object.keys(players).length === 0) {
      for (let i=0;i<9;i++) board[i]=null;
      turn = 'X';
      io.emit('state', { board, turn });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

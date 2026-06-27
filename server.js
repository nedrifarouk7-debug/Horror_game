const WebSocket = require('ws');
const express = require('express');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

let rooms = {};

function broadcast(roomId, message, sender) {
    if (!rooms[roomId]) return;
    rooms[roomId].forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

wss.on('connection', (ws) => {
    let currentRoom = null;
    let playerName = "";
    let playerId = Math.random().toString(36).substr(2, 9);

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            
            switch(msg.action) {
                case 'create_room':
                    const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
                    rooms[roomCode] = [ws];
                    currentRoom = roomCode;
                    playerName = msg.name;
                    ws.playerId = playerId;
                    ws.playerName = playerName;
                    
                    ws.send(JSON.stringify({
                        action: 'room_created',
                        room_code: roomCode,
                        player_id: playerId
                    }));
                    break;

                case 'join_room':
                    const code = msg.room_code.toUpperCase();
                    if (!rooms[code]) {
                        ws.send(JSON.stringify({ action: 'error', message: 'الغرفة غير موجودة' }));
                        return;
                    }
                    if (rooms[code].length >= 4) {
                        ws.send(JSON.stringify({ action: 'error', message: 'الغرفة ممتلئة' }));
                        return;
                    }
                    
                    rooms[code].push(ws);
                    currentRoom = code;
                    playerName = msg.name;
                    ws.playerId = playerId;
                    ws.playerName = playerName;
                    
                    broadcast(code, {
                        action: 'player_joined',
                        player_id: playerId,
                        player_name: playerName
                    }, ws);
                    
                    const players = rooms[code].map(c => c.playerName || "Unknown");
                    ws.send(JSON.stringify({
                        action: 'joined',
                        room_code: code,
                        player_id: playerId,
                        players: players
                    }));
                    break;

                case 'start_game':
                    if (currentRoom) {
                        broadcast(currentRoom, { action: 'game_started' }, ws);
                    }
                    break;

                case 'update':
                    if (currentRoom) {
                        broadcast(currentRoom, {
                            action: 'player_update',
                            player_id: playerId,
                            position: msg.position,
                            rotation: msg.rotation
                        }, ws);
                    }
                    break;
            }
        } catch(e) {
            console.log('Error:', e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom] = rooms[currentRoom].filter(c => c !== ws);
            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
            } else {
                broadcast(currentRoom, {
                    action: 'player_left',
                    player_id: playerId
                }, ws);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Server running on port', PORT);
});

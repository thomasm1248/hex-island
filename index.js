// Server setup
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Globals
config = {
	viewDist: 3
};
var map;
var players = [];

// Util functions
function v(x, y) {
	return {
		x: x,
		y: y
	};
}
function hexDist(a, b) {
	d = v(b.x - a.x, b.y - a.y);
	if(d.x * d.y >= 0) {
		// Signs are the same
		return Math.abs(d.x + d.y);
	} else {
		// Signs are different
		return Math.min(Math.abs(d.x), Math.abs(d.y));
	}
}

// A player character
function Player(x, y, name, socket) {
	this.name = name;
	this.pos = v(x, y);
	this.socket = socket;
}

// The world map
function Map() {
	this.tiles = {};
}
Map.prototype.id = function(x, y) {
	return x + "," + y;
};
Map.prototype.setTile = function(x, y, type) {
	this.tiles[this.id(x, y)] = {
		x: x,
		y: y,
		type: type
	};
};
Map.prototype.getTile = function(x, y) {
	var id = this.id(x, y);
	if(this.tiles[id] === undefined) {
		return "";
	} else {
		return this.tiles[id].type;
	}
};

// Game simulation procedures

// Initialize world
map = new Map();
var temporaryTiles = ["dirt", "grass", "gravel", "stone"];
for(var x = -20; x <= 20; x++) {
	for(var y = -20; y <= 20; y++) {
		if(hexDist(v(0,0), v(x,y)) <= 20) {
			map.setTile(x, y, temporaryTiles[Math.floor(Math.random() * 4)]);
		}
	}
}

// Send the user the main page when they join
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

// Set up new players
io.on('connection', (socket) => {
	// Let me know a player joined
	console.log('a player connected');
	// Create a new player object
	var player = new Player(0, 0, "human", socket);
	players.push(player);
	// Give player a map
	for(var x = -3; x <= 3; x++) {
		for(var y = -3; y <= 3; y++) {
			if(hexDist(v(0,0), v(x,y)) <= 3) {
				socket.emit("tile", map.tiles[map.id(x,y)]);
			}
		}
	}
	// Setup disconnect procedure
	socket.on('disconnect', () => {
		console.log('user disconnected');
		for(var i = 0; i < players.length; i++) {
			if(players[i] === player) {
				players.splice(i, 1);
				break;
			}
		}
	});

	socket.on('action', function(direction) {
		switch(direction) {
			case "up":
				player.pos.x++;
				player.pos.y--;
				socket.emit('move-camera', player.pos);
				break;
			case "down":
				player.pos.x--
				player.pos.y++
				socket.emit('move-camera', player.pos);
				break;
			case "left-d":
				player.pos.x--
				socket.emit('move-camera', player.pos);
				break;
			case "left-u":
				player.pos.y--;
				socket.emit('move-camera', player.pos);
				break;
			case "right-d":
				player.pos.y++
				socket.emit('move-camera', player.pos);
				break;
			case "right-u":
				player.pos.x++;
				socket.emit('move-camera', player.pos);
				break;
		}
	});
	socket.on('request-tile', function(pos) {
		if(hexDist(pos, player.pos) <= config.viewDist) {
			if(map.tiles[map.id(pos.x,pos.y)] !== undefined) {
				socket.emit("tile", map.tiles[map.id(pos.x,pos.y)]);
			}
		}
	});
	// Template for future uses
	socket.on('event name', (msg) => {
		io.emit('event name', msg);
	});
});

// Let me know that the server is running
server.listen(process.env.PORT || 3000, () => {
	console.log('listening on *:3000');
});

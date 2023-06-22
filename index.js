// Server setup
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Globals
config = {
	tickLength: 100,
	loadDist: 4,
	basicActionCooldown: 600,
	gameDayLength: 3600000 // 1 hour in milliseconds
};
var map;
var gameTime = {
	day: 0,
	hour: 9
};
var players = [];
var entities = [];
var entityIDCounter = 0;
var newEntityID = () => { return entityIDCounter++; };

// Util functions
function v(x, y) {
	return {
		x: x,
		y: y
	};
}
function addV(a, b) {
	return v(a.x + b.x, a.y + b.y);
}
function subV(a, b) {
	return v(a.x - b.x, a.y - b.y);
}
function hexDist(a, b) {
	d = v(b.x - a.x, b.y - a.y);
	if(d.x * d.y >= 0) {
		// Signs are the same
		return Math.abs(d.x + d.y);
	} else {
		// Signs are different
		return Math.max(Math.abs(d.x), Math.abs(d.y));
	}
}
var directions = {
	"up": v(1,-1),
	"down": v(-1,1),
	"left-d": v(-1,0),
	"left-u": v(0,-1),
	"right-d": v(0,1),
	"right-u": v(1,0)
};

// A player character
function Player(x, y, name, socket) {
	this.id = newEntityID();
	this.name = name;
	this.pos = v(x, y);
	this.socket = socket;
	this.actionQueue = [];
	this.actionInProgress = false;
}
Player.prototype.canMove = function(direction) {
	var destTilePos = addV(this.pos, directions[direction]);
	var destinationTile = map.getTile(destTilePos.x, destTilePos.y);
	var currentTile = map.getTile(this.pos.x, this.pos.y);
	return Math.abs(destinationTile.height - currentTile.height) <= 1;
};
Player.prototype.getEntityProfile = function() {
	return {
		id: this.id,
		pos: this.pos,
		name: this.name,
		type: "player"
	};
};
Player.nextAction = function(player) {
	// Make sure there's an action in the queue
	if(player.actionQueue.length === 0) {
		player.actionInProgress = false;
		return;
	}
	// Start action
	player.actionInProgress = true;
	var action = player.actionQueue[0];
	player.actionQueue.splice(0, 1);
	// Schedule next action
	setTimeout(Player.nextAction, config.basicActionCooldown, player);
	// Complete current action
	if(action === 'wait' || !player.canMove(action)) return;
	player.pos = addV(player.pos, directions[action]);
};

// The world map
function Map() {
	this.tiles = {};
}
Map.prototype.id = function(x, y) {
	return x + "," + y;
};
Map.prototype.setTile = function(x, y, type, height, hiddenData={}, data={}) {
	this.tiles[this.id(x, y)] = {
		x: x,
		y: y,
		type: type,
		height: height,
		data: data,
		hiddenData: hiddenData
	};
};
Map.prototype.getTile = function(x, y) {
	var id = this.id(x, y);
	if(this.tiles[id] === undefined) {
		return {
			x: x,
			y: y,
			height: 0,
			type: '',
			data: {}
		};
	} else {
		return this.tiles[id];
	}
};

// Game simulation procedures

// Initialize world
map = new Map();
var temporaryTiles = ['sand', 'dirt', 'grass', 'shrub', 'herb', 'rocks', 'stone', 'tree', 'undergrowth'];
for(var x = -20; x <= 20; x++) {
	for(var y = -20; y <= 20; y++) {
		if(hexDist(v(0,0), v(x,y)) <= 20) {
			map.setTile(
				x,
				y,
				temporaryTiles[Math.floor(Math.random() * 9)],
				Math.floor(Math.random() * 5)
			);
		}
	}
}

// Send the user the main page when they join
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

// Game procedures

// Set up new players
io.on('connection', (socket) => {
	// Let me know a player joined
	console.log('a player connected');
	// Create a new player object
	var player = new Player(0, 0, "human", socket);
	players.push(player);
	entities.push(player);
	// Give player info about their character
	socket.emit('character-init', {
		id: player.id
	});
	// Give player a map and place camera
	for(var x = -3; x <= 3; x++) {
		for(var y = -3; y <= 3; y++) {
			if(hexDist(v(0,0), v(x,y)) <= 3) {
				socket.emit("tile", map.tiles[map.id(x,y)]);
			}
		}
	}
	socket.emit('move-camera', player.pos);
	// Give player the game time
	socket.emit('time', gameTime);
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
	// Setup player action queue system
	socket.on('action', function(action) {
		if(action === 'cancel') {
			player.actionQueue = [];
			return;
		}
		player.actionQueue.push(action);
		if(!player.actionInProgress) {
			Player.nextAction(player);
		}
	});
	// Setup client tile request system
	socket.on('request-tile', function(pos) {
		if(hexDist(pos, player.pos) <= config.loadDist) {
			if(map.tiles[map.id(pos.x,pos.y)] !== undefined) {
				socket.emit("tile", map.tiles[map.id(pos.x,pos.y)]);
			} else {
				socket.emit('tile', {
					x: pos.x,
					y: pos.y,
					type: 'water',
					height: 0,
					data: {}
				});
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

// Setup game-time hour ticker
function nextHour() {
	setTimeout(nextHour, config.gameDayLength / 24);
	gameTime.hour++;
	if(gameTime.hour > 24) {
		gameTime.hour = 1;
		gameTime.day++;
	}
	io.emit('time', gameTime);
}
setTimeout(nextHour, config.gameDayLength / 24);

// Simulation loop
function simulate() {
	setTimeout(simulate, config.tickLength);
	// Send lists of entities to all players
	for(var i = 0; i < players.length; i++) {
		var player = players[i];
		var nearbyEntities = [];
		for(var j = 0; j < entities.length; j++) {
			if(hexDist(player.pos, entities[j].pos) <= config.loadDist) {
				nearbyEntities.push(entities[j].getEntityProfile());
			}
		}
		player.socket.emit('entities', nearbyEntities);
	}
}
simulate();

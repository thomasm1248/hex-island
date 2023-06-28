// Server setup
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require('fs');

// Globals
config = {
	mapSize: 1000, // used for map file read, and player spawning
	tickLength: 100, // milliseconds between each tick
	loadDist: 4, // distance players are allowed to load tiles
	basicActionCooldown: 600, // milliseconds player must wait between basic actions
	shrubMovementCost: 600, // extra ms player must wait when moving from shrub tile
	gameDayLength: 3600000 // 1 hour in milliseconds
};
if(false) {
	config.loadDist = 12;
	config.basicActionCooldown = 0;
	config.shrubMovementCost = 0;
	config.canTeleport = true;
}
var map;
var gameTime = {
	day: 0,
	hour: 9
};
var playersOnline = 0; // Keep count of active players
var players = []; // List of player characters
var entities = []; // List of all entities including player characters
// System for generating unique IDs for each entity
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
var directions = { // List of vectors for each direction
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
	this.inventory = ['', '', '', '', '', '', ''];
}
Player.prototype.swapInventoryItems = function(direction) {
	var inHand = this.inventory[0];
	switch(direction) {	
		case 'up':
			this.inventory[0] = this.inventory[1];
			this.inventory[1] = inHand;
			break;
		case 'right-u':
			this.inventory[0] = this.inventory[2];
			this.inventory[2] = inHand;
			break;
		case 'right-d':
			this.inventory[0] = this.inventory[3];
			this.inventory[3] = inHand;
			break;
		case 'down':
			this.inventory[0] = this.inventory[4];
			this.inventory[4] = inHand;
			break;
		case 'left-d':
			this.inventory[0] = this.inventory[5];
			this.inventory[5] = inHand;
			break;
		case 'left-u':
			this.inventory[0] = this.inventory[6];
			this.inventory[6] = inHand;
			break;
	}
};
Player.prototype.getNearbyTile = function(relativePos) {
	var pos = addV(this.pos, relativePos);
	return map.getTile(pos.x, pos.y);
};
Player.prototype.canMove = function(direction) {
	var destTilePos = addV(this.pos, directions[direction]);
	var destinationTile = map.getTile(destTilePos.x, destTilePos.y);
	var blocked = false;
	// Check for a tile type that isn't allowed
	switch(destinationTile.type) {
		case 'T':
			blocked = true;
			break;
		case 'W':
			blocked = true;
			break;
	}
	// Check for steep terrain
	var currentTile = map.getTile(this.pos.x, this.pos.y);
	if(Math.abs(destinationTile.height - currentTile.height) > 1) blocked = true;
	// Check for an entity
	for(var i = 0; i < entities.length; i++) {
		if(hexDist(entities[i].pos, destTilePos) === 0) {
			blocked = true;
			break;
		}
	}
	// Return result
	return !blocked;
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
	if(
		player.getNearbyTile(v(0,0)).type === 'S' ||
		action !== 'special' && player.getNearbyTile(directions[action]).type === 'S'
	) {
		setTimeout(Player.finishAction, config.shrubMovementCost, player, action);
	} else {
		Player.finishAction(player, action);
	}
};
Player.finishAction = function(player, action) {
	// Schedule next action
	setTimeout(Player.nextAction, config.basicActionCooldown, player);
	// Complete current action
	if(action === 'special' || !player.canMove(action)) return;
	player.pos = addV(player.pos, directions[action]);
};

// The world map
function Map() {
	this.tiles = [];
}
Map.prototype.setTile = function(x, y, type, height, hiddenData={}, data={}) {
	this.tiles[x][y] = {
		x: x,
		y: y,
		type: type,
		height: height,
		data: data,
		hiddenData: hiddenData
	};
};
Map.prototype.getTile = function(x, y) {
	if(x < 0 || y < 0 || x >= this.tiles.length || y >= this.tiles[x].length) {
		// Make map act like everything off the map is made of water
		return {
			x: x,
			y: y,
			height: 0,
			type: 'W',
			data: {}
		};
	} else {
		return this.tiles[x][y];
	}
};

// Read map data from map file
var data;
try {
	data = fs.readFileSync('map.csv', 'utf8');
} catch (err) {
	console.log('Map file could not be read.');
	process.exit(1); // Terminate with error
}
console.log("Reading map data");
data = data.split('\n');
map = new Map();
for(var x = 0; x < config.mapSize; x++) {
	map.tiles.push([]);
	for(var y = 0; y < config.mapSize; y++) {
		var line = data[x*config.mapSize + y];
		line = line.split(',');
		map.setTile(x, y, line[0], line[1]);
	}
}
console.log("Finish reading map data");

// Send the user the html page when they join
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

// Set up new players
io.on('connection', (socket) => {
	// Let me know a player joined
	console.log('a player connected');
	// Function-scope variable for storing character current user is playing as
	var player;
	// Wait for player to login
	socket.on('request-character', function(characterName) {
		// Try to find character in current player list
		var playerCharacterFound = false;
		for(var i = 0; i < players.length; i++) {
			if(players[i].name === characterName) {
				playerCharacterFound = true;
				player = players[i];
				break;
			}
		}
		// If character was found, but is in use, deny user
		if(playerCharacterFound && player.socket !== undefined) {
			socket.emit('character-in-use');
			player = undefined;
			return;
		}
		// If character wasn't found, make a new one
		if(!playerCharacterFound) {
			console.log('Generating new player character');
			var pos = v(0,0);
			var sharingTileWithEntity = true; // flag
			while(
				map.getTile(pos.x, pos.y).type !== 'N' ||
				sharingTileWithEntity
			) {
				// Generate a new spawn point
				pos = v(
					Math.floor(Math.random() * config.mapSize),
					Math.floor(Math.random() * config.mapSize)
				);
				// Check if there's already an entity there
				sharingTileWithEntity = false;
				for(var i = 0; i < entities.length; i++) {
					if(hexDist(pos, entities[i].pos) === 0) {
						sharingTileWithEntity = true;
						break;
					}
				}
			}
			player = new Player(pos.x, pos.y, characterName, socket);
			players.push(player);
			entities.push(player);
		}
		// Connect socket to character
		player.socket = socket;
		// Give player a map and place camera
		for(var x = -3; x <= 3; x++) {
			for(var y = -3; y <= 3; y++) {
				if(hexDist(v(0,0), v(x,y)) <= 3) {
					socket.emit("tile", map.getTile(x,y));
				}
			}
		}
		// Give player info about their character
		socket.emit('character-init', {
			id: player.id,
			name: player.name,
			inventory: player.inventory
		});
		socket.emit('set-camera', player.pos);
		// Give player the game time
		socket.emit('time', gameTime);
		// Increment number of active players
		playersOnline++;
		io.emit('players-online', playersOnline);
	});
	// Setup disconnect procedure
	socket.on('disconnect', () => {
		// Check if player has a character loaded
		if(player === undefined) return;
		// Update count of active players
		playersOnline--;
		io.emit('players-online', playersOnline);
		// Print message
		console.log('a player disconnected');
		// Disconnect socket from character
		player.socket = undefined;
	});
	// Setup player action queue system
	socket.on('action', function(action) {
		// Check if player has a character loaded
		if(player === undefined) return;
		// Queue requested action
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
		// Check if player has a character loaded
		if(player === undefined) return;
		// Send the player the tile if it's within their view
		if(hexDist(pos, player.pos) <= config.loadDist) {
			socket.emit("tile", map.getTile(pos.x,pos.y));
		}
	});
	// Teleportation for debugging
	socket.on('tp', (pos) => {
		// Check if player has a character loaded
		if(player === undefined) return;
		// Teleport the player
		player.pos = pos;
	});
});

// Let me know that the server is running
server.listen(process.env.PORT || 3000, () => {
	console.log('listening on *:3000');
});

// Setup game-time hour ticker
function nextHour() {
	// Schedule next tick
	setTimeout(nextHour, config.gameDayLength / 24);
	// Increment hour
	gameTime.hour++;
	if(gameTime.hour > 24) {
		// Advance to the next day
		gameTime.hour = 1;
		gameTime.day++;
	}
	// Broadcast time to players
	io.emit('time', gameTime);
}
setTimeout(nextHour, config.gameDayLength / 24);

// Game simulation procedures

// Simulation loop
function simulate() {
	setTimeout(simulate, config.tickLength);
	// Send lists of entities to all players
	for(var i = 0; i < players.length; i++) {
		var player = players[i];
		// Skip disconnected players
		if(player.socket === undefined) continue;
		// Send the player a list of nearby entities
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

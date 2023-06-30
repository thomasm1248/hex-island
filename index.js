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
function updatePlayerMaps(tile) {
	for(var i = 0; i < players.length; i++) {
		if(players[i].socket !== undefined && hexDist(tile, players[i].pos) <= config.loadDist) {
			players[i].socket.emit('tile', tile);
		}
	}
}

// Lookup tables
var action2InventoryIndex = {
	'up': 1,
	'right-u': 2,
	'right-d': 3,
	'down': 4,
	'left-d': 5,
	'left-u': 6
};
var craftingRecipes = {
	// Rock processing
	'small rock, flint': [
		{p: 3, o: ['small rock', 'flint']},
		{p: 2, o: ['small rock', 'flint', 'flint chip']},
		{p: 1, o: ['small rock', 'spear head', 'flint chip']}],
	'small rock, spear head': [
		{p: 3, o: ['small rock', 'spear head']},
		{p: 2, o: ['small rock', 'spear head', 'flint chip']},
		{p: 1, o: ['small rock', 'flint chip']}],
	'rock, rock': [
		{p: 2, o: ['rock', 'rock']},
		{p: 1, o: ['rock', 'chopping tool']}],
	'rock, chopping tool': [
		{p: 5, o: ['rock', 'chopping tool']},
		{p: 1, o: ['rock', 'hand axe']}],
	'hand axe, flat rock': [
		{p: 5, o: ['hand axe', 'flat rock']},
		{p: 1, o: ['axe head', 'flat rock']}],
	// Nettle cordage
	'flint chip, nettle': [
		{p: 1, o: ['flint chip', 'nettle fiber']}],
	'nettle fiber, nettle fiber': [
		{p: 1, o: ['cord']}],
	'cord, cord': [
		{p: 1, o: ['rope']}],
	'rope, ': [
		{p: 1, o: ['cord', 'cord']}],
	// Branch processing
	'hand axe, branch': [
		{p: 1, o: ['hand axe', 'stick']},
		{p: 1, o: ['hand axe', 'small stick']},
		{p: 1, o: ['hand axe', 'staff']}],
	'axe head, branch': [
		{p: 1, o: ['axe head', 'stick']},
		{p: 1, o: ['axe head', 'small stick']},
		{p: 1, o: ['axe head', 'staff']}],
	// Spear
	'spear head, staff': [
		{p: 1, o: ['staff with spear head']}],
	'staff, spear head': [
		{p: 1, o: ['staff with spear head']}],
	'staff with spear head, ': [
		{p: 1, o: ['staff', 'spear head']}],
	'cord, staff with spear head': [
		{p: 1, o: ['spear']}],
	'spear, ': [
		{p: 1, o: ['staff with spear head', 'cord']}],
	// Sharpen a staff
	'staff, flat rock': [
		{p: 3, o: ['staff', 'flat rock']},
		{p: 1, o: ['sharpened staff', 'flat rock']}],
	// Stone axe
	'axe head, stick': [
		{p: 1, o: ['stick with axe head']}],
	'stick, axe head': [
		{p: 1, o: ['stick with axe head']}],
	'stick with axe head, ': [
		{p: 1, o: ['stick', 'axe head']}],
	'cord, stick with axe head': [
		{p: 1, o: ['stone axe']}],
	'stone axe, ': [
		{p: 1, o: ['stick with axe head', 'cord']}],
	// Re-sharpening stone axe
	'chipped stone axe, flat rock': [
		{p: 1, o: ['stone axe', 'flat rock']}],
	// Recycling broken handle of stone axe
	'hand axe, broken handle': [
		{p: 1, o: ['hand axe', 'small stick']}],
	'axe head, broken handle': [
		{p: 1, o: ['axe head', 'small stick']}],
	// Use hand axe to split sticks into smaller sticks
	'hand axe, stick': [
		{p: 1, o: ['hand axe', 'small stick', 'small stick']}],
	// Bow drill for starting fires
	'cord, small stick': [
		{p: 1, o: ['small bow']}],
	'small bow, ': [
		{p: 1, o: ['small stick', 'cord']}],
	'small bow, small stick': [
		{p: 1, o: ['bow drill']}],
	'small stick, small bow': [
		{p: 1, o: ['bow drill']}],
	'bow drill, ': [
		{p: 1, o: ['small bow', 'stick']}],
	// Fire board
	'chopping tool, small stick': [
		{p: 1, o: ['chopping tool', 'fire board']}],
	'chopping tool, stick': [
		{p: 1, o: ['chopping tool', 'fire board']}],
	// Combining bow drill with fire board
	'bow drill, fire board': [
		{p: 1, o: ['bow drill with fire board']}],
	'bow drill with fire board, ': [
		{p: 1, o: ['bow drill', 'fire board']}],
	// Processing bark to make tinder
	'rock, bark': [
		{p: 1, o: ['rock', 'bark']},
		{p: 1, o: ['rock', 'bark tinder']}],
	// Start a fire
	'bow drill with fire board, dry grass': [
		{p: 3, o: ['bow drill with fire board', 'dry grass']},
		{p: 1, o: ['bow drill with fire board', 'smoking tinder']}],
	'bow drill with fire board, dry leaves': [
		{p: 6, o: ['bow drill with fire board', 'dry leaves']},
		{p: 1, o: ['bow drill with fire board', 'smoking tinder']}],
	'bow drill with fire board, bark tinder': [
		{p: 1, o: ['bow drill with fire board', 'bark tinder']},
		{p: 1, o: ['bow drill with fire board', 'smoking tinder']}]
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
	this.inventoryMode = false;
}
Player.prototype.swapInventoryItems = function(direction) {
	var inHand = this.inventory[0];
	var index = action2InventoryIndex[direction];
	this.inventory[0] = this.inventory[index];
	this.inventory[index] = inHand;
};
Player.prototype.getItem = function(item) {
	for(var i = 0; i < this.inventory.length; i++) {
		if(this.inventory[i] === '') {
			this.inventory[i] = item;
			return;
		}
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
	if(player.inventoryMode) {
		Player.finishInventoryAction(player, action);
	} else {
		Player.finishAction(player, action);
	}
};
Player.finishInventoryAction = function(player, action) {
	// Schedule next action
	setTimeout(Player.nextAction, config.basicActionCooldown, player);
	// Check if hand item is prepped for crafting/dropping
	if(player.handItemPrepped) { // todo finish all this
		// Craft or drop
		player.handItemPrepped = false;
		if(action === 'special') {
			player.inventory[0] = '';
		} else {
			var in2Index = action2InventoryIndex[action];
			var in1 = player.inventory[0];
			var in2 = player.inventory[in2Index];
			var input = in1 + ', ' + in2;
			if(craftingRecipes[input] === undefined) {
				return;
			}
			var possibleOutputs = craftingRecipes[input];
			var totalWeights = 0;
			for(var i = 0; i < possibleOutputs.length; i++) {
				totalWeights += possibleOutputs[i].p;
			}
			var selector = Math.random() * totalWeights;
			for(var i = 0; i < possibleOutputs.length; i++) {
				if(selector < possibleOutputs[i].p) {
					var output = possibleOutputs[i].o;
					player.inventory[0] = output[0];
					if(output[1] === undefined) {
						player.inventory[in2Index] = '';
					} else {
						player.inventory[in2Index] = output[1];
					}
					if(output[2] !== undefined) {
						player.getItem(output[2]);
					}
					break;
				}
				selector -= possibleOutputs[i].p;
			}
		}
	} else {
		// Swap or prep
		if(action === 'special') {
			player.handItemPrepped = true;
		} else {
			player.swapInventoryItems(action);
		}
	}
	player.socket.emit('inventory', player.inventory);
};
Player.finishAction = function(player, action) {
	// Schedule next action
	setTimeout(Player.nextAction, config.basicActionCooldown, player);
	// Complete current action
	if(action === 'special') {
		var currentTile = map.getTile(player.pos.x, player.pos.y);
		switch(player.inventory[0]) {
			case '': // bare hand
				if(false) { // todo check if items are on the ground
				} else {
					switch(currentTile.type) {
						case 'G':
							player.getItem('dry grass');
							break;
						case 'U':
							player.getItem('dry leaves');
							break;
						case 'R':
							player.getItem(
								['rock', 'small rock', 'flat rock', 'flint']
								[Math.floor(Math.random() * 4)]
							);
							break;
						case 'H':
							if(currentTile.data.h === 'n') {
								player.getItem('nettle');
								currentTile.type = 'G';
								delete currentTile.data.h;
								updatePlayerMaps(currentTile);
							}
							break;
					}
				}
				break;
			case 'flint chip':
				switch(currentTile.type) {
					case 'H':
						if(currentTile.data.h === 'n') {
							player.getItem('nettle');
							currentTile.type = 'G';
							delete currentTile.data.h;
							updatePlayerMaps(currentTile);
						}
						break;
				}
				break;
		}
		player.socket.emit('inventory', player.inventory);
	} else if(!player.canMove(action)) {
		var destTilePos = addV(player.pos, directions[action]);
		var destinationTile = map.getTile(destTilePos.x, destTilePos.y);
		if(destinationTile.type === 'T') {
			// Action: collect resources from tree
			switch(player.inventory[0]) {
				case 'chopping tool':
					player.getItem('bark');
					break;
				case 'hand axe':
					player.getItem('branch');
					break;
				case 'axe head':
					player.getItem('branch');
					if(Math.random() < 1/5) player.inventory[0] = 'hand axe';
					break;
				case 'stone axe':
					if(Math.random() < 1/10) {
						destinationTile.type = 'U';
						updatePlayerMaps(destinationTile);
					}
					if(Math.random() < 1/3) player.inventory[0] = 'chipped stone axe';
					if(Math.random() < 1/50) player.inventory[0] = 'broken handle';
					break;
				case 'chipped stone axe':
					if(Math.random() < 1/12) {
						destinationTile.type = 'U';
						updatePlayerMaps(destinationTile);
					}
					if(Math.random() < 1/15) player.inventory[0] = 'broken handle';
					break;
			}
			player.socket.emit('inventory', player.inventory);
		}
	} else {
		player.pos = addV(player.pos, directions[action]);
	}
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
		// Interpret all herbs as nettle
		var d = {};
		if(line[0] === 'H') {
			d = {h: 'n'}; // herb: nettle
		}
		map.setTile(x, y, line[0], line[1], {}, d);
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
		// Exit player out of inventory mode
		player.inventoryMode = false;
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
	// Setup inventory toggle action
	socket.on('inventory', function() {
		// Check if player has a character loaded
		if(player === undefined) return;
		// Toggle inventory mode
		player.inventoryMode = !player.inventoryMode;
		socket.emit('update-inventory-mode', player.inventoryMode);
		// Clear action queue to prevent player from moving while inventorying
		player.actionQueue = [];
		// Reset prep flag so it doesn't carry over between crafting sessions
		player.handItemPrepped = false; // todo set up system that allows player to know whether they're prepped
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

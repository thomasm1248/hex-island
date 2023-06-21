// Socket setup
var socket = io();
socket.on('event name', function(msg) {
});

// Globals
var mouse = {
	x: 0,
	y: 0
};

// Util functions
function hexDist(a, b) {
	var d = {
		x: b.x - a.x,
		y: b.y - a.y
	};
	// Test the x and y coordinates
	if(d.x * d.y >= 0) {
		// If they have the same sign
		// return the sum
		return Math.abs(d.x + d.y);
	} else {
		// If they have different signs
		// return the smallest
		return Math.min(Math.abs(d.x), Math.abs(d.y));
	}
}


// Game event functions

// Map manager
function Map() {
	this.tiles = {};
	this.cameraPos = {
		x: camX,
		y: camY
	};
}
Map.prototype.id = function(x, y) {
	return x + "," + y;
};
Map.prototype.getTile = function(x, y) {
	var id = this.id(x, y);
	if(this.tiles[id] === undefined) {
		return "";
	} else {
		return this.tiles[id].type;
	}
};
Map.prototype.setTile = function(x, y, type) {
	this.tiles[this.id(x, y)] = {
		type: type,
		x: x,
		y: y
	};
};
Map.prototype.purgeTiles = function(cutoffDist) {
	for(var id in this.tiles) {
		if(hexDist(this.cameraPos, this.tiles[id]) > cutoffDist) {
			delete this.tiles[id];
		}
	}
};
Map.prototype.draw = function() {
};

// Setup the canvas
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

// Handle click events (the only type of event this game will use)
window.onclick = function(e) {
	mouse.x = e.clientX;
	mouse.y = e.clientY;
	alert("clicked");
};
window.onkeydown = function(e) {
	switch(e.keyCode) {
	}
};

// Draw loop
function draw() {
	window.requestAnimationFrame(draw);
}
draw();

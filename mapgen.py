import opensimplex as sn
import math as m

# Presets
size = 100
scale = 0.2
maxHeight = 10

# Globals
tiles = []

# Util functions
class v:
	def __init__(self, x, y):
		self.x = x
		self.y = y
def addV(a, b):
	return v(a.x + b.x, a.y + b.y)
def subV(a, b):
	return v(a.x - b.x, a.y - b.y)
def scaleV(a, s):
	return v(a.x * s, a.y * s)
hexX = v(m.cos(-m.pi/6), m.sin(-m.pi/6))
hexY = v(m.cos(m.pi/6), m.sin(m.pi/6))
def hexCoords(x, y):
	return addV(scaleV(hexX, x), scaleV(hexY, y))
def getHeight1(x, y):
	pos = scaleV(hexCoords(x, y), scale)
	noise = sn.noise2(pos.x, pos.y)
	return m.floor((noise + 1)/2 * maxHeight)
def export():
	file = open("map.csv", "w")
	lines = []
	for x in range(0, size):
		for y in range(0, size):
			lines.append("%s,%d"%(
				tiles[x][y]['type'],
				tiles[x][y]['height']
				))
	file.write('\n'.join(lines))
	file.close()

# Test: generate island of sand
sn.random_seed()
for x in range(0, size):
	tiles.append([])
	for y in range(0, size):
		tiles[x].append({
			'type': 'dirt',
			'data': {},
			'hiddenData': {},
			'height': getHeight1(x, y)
			})
export()

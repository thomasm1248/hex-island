import opensimplex as sn
import math as m
import random as r

# Presets
size = 100
scale = 0.2
noiseStrength = 5
baseHeight = 15
falloffStrength = 0.0085
numberOfTrees = m.floor(size**2 / 6)
numberOfShrubs = m.floor(size**2 / 3)
numberOfHerbs = m.floor(size**2 / 5)
leavesPerTree = 5

# Globals
tiles = []

# Util functions
class v:
	def __init__(self, x, y):
		self.x = x
		self.y = y
	def __str__(self):
		return '(%d, %d)' % (self.x, self.y)
def lengthV(a):
	return (a.x**2 + a.y**2)**.5
def distV(a, b):
	return lengthV(subV(a, b))
def addV(a, b):
	return v(a.x + b.x, a.y + b.y)
def subV(a, b):
	return v(a.x - b.x, a.y - b.y)
def scaleV(a, s):
	return v(a.x * s, a.y * s)
directions = [
	v(1, -1),
	v(-1, 1),
	v(1, 0),
	v(-1, 0),
	v(0, -1),
	v(0, 1),
	v(0, 0)
	]
hexX = v(m.cos(-m.pi/6), m.sin(-m.pi/6))
hexY = v(m.cos(m.pi/6), m.sin(m.pi/6))
def hexCoords(x, y):
	return addV(scaleV(hexX, x), scaleV(hexY, y))
def getHeight1(x, y):
	pos = scaleV(hexCoords(x, y), scale)
	base = baseHeight - ((size/2-x)**2 + (size/2-y)**2) * falloffStrength
	rawNoise = sn.noise2(pos.x, pos.y)
	scaledNoise = rawNoise * noiseStrength
	totalHeight = base + scaledNoise
	return m.floor(totalHeight)
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
		terrain = 'grass'
		height = getHeight1(x, y)
		if height < 0:
			height = 0
			terrain = 'water'
		tiles[x].append({
			'type': terrain,
			'data': {},
			'hiddenData': {},
			'height': height
			})
for i in range(0, numberOfShrubs):
	x = r.randint(0, size-1)
	y = r.randint(0, size-1)
	if tiles[x][y]['type'] != 'water':
		tiles[x][y]['type'] = 'shrub'
for i in range(0, numberOfHerbs):
	x = r.randint(0, size-1)
	y = r.randint(0, size-1)
	if tiles[x][y]['type'] != 'water':
		tiles[x][y]['type'] = 'herb'
for i in range(0, numberOfTrees):
	x = r.randint(1, size-2)
	y = r.randint(1, size-2)
	if tiles[x][y]['type'] == 'water': continue
	for i in range(0, leavesPerTree):
		chosenDir = r.choice(directions)
		leafPos = addV(v(x,y), chosenDir)
		if tiles[leafPos.x][leafPos.y]['type'] != 'water':
			tiles[leafPos.x][leafPos.y]['type'] = 'undergrowth'
	adjacentTree = False
	for ax in range(-1,2):
		for ay in range(-1, 2):
			if tiles[x+ax][y+ay]['type'] == 'tree':
				adjacentTree = True
				break
	if not adjacentTree:
		tiles[x][y]['type'] = 'tree'

export()

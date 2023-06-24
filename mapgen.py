import opensimplex as sn
import math as m
import random as r

# Presets
size = 1000
baseHeight = 30
falloffRadius = size / 2
# Hills and valleys
mountainNoiseFreq = 0.030
mountainNoiseSize = 80# might have to lower after adding roughness noise
mountainNoiseThinned = 5
# Biome Noise
biomeNoiseFreq = 0.03
# Calculated
mountainNoiseThinning = 1 / falloffRadius**2 * (mountainNoiseSize - mountainNoiseThinned)
falloffStrength = 1 / falloffRadius**2 * (baseHeight + mountainNoiseThinned)
# Foliage
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
def getMountainNoise(p, d):
	p = scaleV(p, mountainNoiseFreq)
	rawNoise = (sn.noise2(p.x, p.y) + 1)**3/8
	maxHeight = -d * mountainNoiseThinning + mountainNoiseSize # shorter towards edges
	return rawNoise * maxHeight
def getHeight1(x, y):
	pos = hexCoords(x - size/2, y - size/2)
	distSquared = pos.x**2 + pos.y**2 + 1 # for /0 cases
	# Get mointain noise
	mountainNoise = getMountainNoise(pos, distSquared)
	# Build island shape
	base = baseHeight - distSquared * falloffStrength
	# Add noise
	totalHeight = base + mountainNoise
	return totalHeight
def getBiomeNoise(x, y):
	pos = hexCoords(x - size/2, y - size/2)
	pos = scaleV(pos, biomeNoiseFreq)
	return sn.noise2(pos.x, pos.y)
def fadeBiome(a, h, b):
	return r.random() * (b-a) > h - a
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

# Test: generate island
sn.random_seed()
for x in range(0, size):
	tiles.append([])
	for y in range(0, size):
		terrain = 'grass'
		height = getHeight1(x, y)
		biome = getBiomeNoise(x, y)
		if height < 0:
			height = 0
			terrain = 'water'
		elif fadeBiome(1, height, 2):
			terrain = 'sand'
		elif height + 10 * biome > 50 and not fadeBiome(40, height, 60):
			terrain = 'stone'
			if r.random() < 0.6:
				terrain = 'rocks'
			height += r.random()
		elif biome > -0.2:
			terrain = 'undergrowth'
		height = m.floor(height)
		tiles[x].append({
			'type': terrain,
			'data': {},
			'hiddenData': {},
			'height': height
			})
for i in range(0, numberOfShrubs):
	x = r.randint(0, size-1)
	y = r.randint(0, size-1)
	if tiles[x][y]['type'] == 'grass' or tiles[x][y]['type'] == 'undergrowth':
		tiles[x][y]['type'] = 'shrub'
for i in range(0, numberOfHerbs):
	x = r.randint(0, size-1)
	y = r.randint(0, size-1)
	if tiles[x][y]['type'] == 'grass' or tiles[x][y]['type'] == 'undergrowth':
		tiles[x][y]['type'] = 'herb'
for i in range(0, numberOfTrees):
	x = r.randint(1, size-2)
	y = r.randint(1, size-2)
	if tiles[x][y]['type'] != 'undergrowth': continue
	'''
	for i in range(0, leavesPerTree):
		chosenDir = r.choice(directions)
		leafPos = addV(v(x,y), chosenDir)
		if tiles[leafPos.x][leafPos.y]['type'] != 'water':
			tiles[leafPos.x][leafPos.y]['type'] = 'undergrowth'
	'''
	# Make sure there are no trees adjacent before placing
	adjacentTree = False
	for ax in range(-1,2):
		for ay in range(-1, 2):
			if tiles[x+ax][y+ay]['type'] == 'tree':
				adjacentTree = True
				break
	if not adjacentTree:
		tiles[x][y]['type'] = 'tree'

export()

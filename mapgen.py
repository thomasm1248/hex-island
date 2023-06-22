import opensimplex as sn
import math as m

# Presets
size = 100

# Globals
tiles = []

# Util functions
def mapValues(n):
	return m.floor((n + 1) * 2)
def getHeight1(x, y):
	noise = sn.noise2(x, y)
	return m.floor((noise + 1)/2 * 10)
def export():
	file = open("map.csv", "w")
	for x in range(0, size):
		for y in range(0, size):
			file.write("%s,%d\n"%(
				tiles[x][y]['type'],
				tiles[x][y]['height']
				))
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

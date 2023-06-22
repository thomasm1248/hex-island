# Hex Island Documentation

## Tiles

- Each tile represented by a single string
- Empty string means map manager doesn't have the tile
- The map manager requests tiles from server, and server makes sure it's allowed

### Types

- Water
- Sand
- Dirt
- Grass
- Shrub
- Herb (what type of plant?)
- Rocks
- Stone
- Tree trunk (what type of tree?)
- Undergrowth (represents area under branches)

## Hex coordinates

Use a grid, but the adjacency map is different. The X and Y axes both increase to the right, but the X axis goes up, while the Y axis goes down. To find the neighboors of a cell, loop through a 3x3 box around it, excluding all cells where the relative coordinates x and y are equal.

## Entities

- Entities will be kept separate from the tiles
- No more than one entity can be on a tile at one time
- Server keeps clients updated about entities within their view
- Each player counts as an entity
- A client manages their player character just like any other entity
- Client regularly requests an updated list of entities
- Server keeps client updated about their entities

__Entity Profile__:
- id
- name
- type
- pos

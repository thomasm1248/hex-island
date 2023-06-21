# Hex Island Documentation

## Tiles

- Each tile represented by a single string
- Empty string means map manager doesn't have the tile
- The map manager requests tiles from server, and server makes sure it's allowed

## Hex coordinates

Use a grid, but the adjacency map is different. The X and Y axes both increase to the right, but the X axis goes up, while the Y axis goes down. To find the neighboors of a cell, loop through a 3x3 box around it, excluding all cells where the relative coordinates x and y are equal.

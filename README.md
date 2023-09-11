# Stockfish

*Made a chess bot to prank my colleague who always beats me at chess.* 

Using [Stockfish](https://stockfishchess.org/) chess engine and [RobotJS](https://robotjs.io/) for screen capturing and mouse movement.

## How it works

```bash
# Installed the chess engine on my macOS
$ brew install stockfish
```

When running the program it will capture a screenshot and divide it into `100px` squares in order to find the rough location of the chess board in the browser. This is done by finding the hex colors of the light and dark squares according to the `CONFIG` object. They vary by screen, I simply used a color picker to find out what colors where on my screen.

```javascript
const CONFIG = {
    colors: {
        light_square: 'EDEDD6',
        dark_square: '80945F',
        border: '302E2B',
    },
    wait_time_ms: {
        min: 1500,
        max: 2500,
    },
}
```

The rough location of the board is found by taking the lowest and highest `x` and `y` values of where the light and dark squares were found. It will then scan pixel by pixel until reaching the border and determining exactly where the board is located. Hence, why the border hex color of the board needs to be specified as well.

![](https://github.com/jack-carling/stockfish/assets/72305598/843cd23b-bb32-478e-9e33-4d21dd8ab50b)

After the exact location has been found the bot will click on the pawns on a7 and b7 in order to compute the exact colors of the highlighted squares. 

![](https://github.com/jack-carling/stockfish/assets/72305598/709d55fb-2fb3-4add-bb03-b73ceb2decef)

The bot will then determine if it's playing as black or white and start playing accordingly. Whenever it's the opponent's turn the bot will wait and scan the board for highlighted squares that indicates a move. When a move has been made, it will be inputted to Stockfish and the terminal will return the best move. Then  RobotJS will move the pieces, so sit back and relax. Oh and if somebody castles it breaks half of the time.

![](https://github.com/jack-carling/stockfish/assets/72305598/6d5e5bbd-af39-4396-a6ac-b2a1ec5d2e78)

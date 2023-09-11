const robot = require('robotjs')
const chalk = require('chalk')
const { spawn } = require('child_process')
const process = spawn('stockfish')

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

const COMPUTED_COLORS = {
    light_highlight: '',
    dark_highlight: '',
    white: '',
    black: '',
}

const STOCKFISH = ['position', 'startpos', 'move']

const PLAY = {
    color: '', // white | black
}

const MATRIX = []

function print(string) {
    console.log(string.padEnd(100, '.'))
}

function error_print(string) {
    console.log(chalk.red(`${'#'.repeat(10)} ERROR ${'#'.repeat(10)}`))
    console.log(string.padEnd(100, '.'))
}

async function run() {
    print('Running Stockfish')
    process.stdout.setEncoding('utf8')
    process.stdout.on('data', function (data) {
        // console.log(data)
        const best_move = (data.match(/bestmove\s(.\w+)/) || [null, null])[1]
        const mate = data.includes('mate 1')
        if (best_move) {
            print(`Best move: ${best_move}`)
            play_move(best_move, mate)
        }
    })

    await find_board_location()

    print('Start playing')
    start_playing()
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function find_board_location() {
    return new Promise(async (resolve) => {
        print('Capturing screen')
        const screen = robot.screen.capture()
        print('Finding location of board on screen')
        const positions_x = []
        const positions_y = []
        console.time('BOARD')
        for (let x = 0; x < screen.width; x += 100) {
            for (let y = 0; y < screen.height; y += 100) {
                const color = screen.colorAt(x, y)
                if (
                    color === CONFIG.colors.dark_square.toLowerCase() ||
                    color === CONFIG.colors.light_square.toLowerCase()
                ) {
                    positions_x.push(x)
                    positions_y.push(y)
                }
            }
        }
        console.timeEnd('BOARD')
        if (!isFinite(Math.min(...positions_x)) || !isFinite(Math.min(...positions_y))) {
            return error_print('Could not find chess board, make sure colors are correct')
        }

        print('Found rough location, recalibrating')

        // Top left is white square, top right is green square
        // Bottom left is green square, bottom right is white square

        let min_x = Math.min(...positions_x)
        let max_x = Math.max(...positions_x)
        let min_y = Math.min(...positions_y)
        let max_y = Math.max(...positions_y)

        print(`X: ${min_x}/${max_x}`)
        print(`Y: ${min_y}/${max_y}`)

        while (true) {
            const color = screen.colorAt(min_x - 1, min_y)
            if (color === CONFIG.colors.border.toLowerCase()) break
            min_x--
        }
        while (true) {
            const color = screen.colorAt(min_x, min_y - 1)
            if (color === CONFIG.colors.border.toLowerCase()) break
            min_y--
        }
        while (true) {
            const color = screen.colorAt(max_x + 1, max_y)
            if (color === CONFIG.colors.border.toLowerCase()) break
            max_x++
        }
        while (true) {
            const color = screen.colorAt(max_x, max_y + 1)
            if (color === CONFIG.colors.border.toLowerCase()) break
            max_y++
        }

        print('Done calibrating')
        print(`X: ${min_x}/${max_x}`)
        print(`Y: ${min_y}/${max_y}`)

        print('Calculating board size and starting color')

        const board_width = max_x - min_x
        const board_height = max_y - min_y
        const average = Math.round((board_height + board_width) / 2)
        const square_size = Math.round(average / 8)
        print(`Board size: ${average}`)
        print(`Square size: ${square_size}`)

        print('Populating matrix')
        find_playing_color(min_x, min_y, square_size)
        populate_matrix(min_x, min_y, square_size)
        await compute_colors()
        resolve()
    })
}

function populate_matrix(x, y, size) {
    const matrix = []
    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8']
    const letters = ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']

    if (PLAY.color === 'white') {
        numbers.reverse()
        letters.reverse()
    }
    for (let i = 0; i < 8; i++) {
        const row = []
        for (let j = 1; j <= 8; j++) {
            const corner_y = i * size + y + Math.round(size * 0.08)
            const piece_y = i * size + y + size - Math.round(size * 0.2)
            const corner_x = j * size + x - Math.round(size * 0.08)
            const piece_x = j * size + x - size / 2
            const number = numbers[i]
            const letter = letters[j - 1]
            const data = {
                x: corner_x,
                y: corner_y,
                piece: {
                    x: Math.round(piece_x),
                    y: Math.round(piece_y),
                },
                position: `${letter}${number}`,
            }
            row.push(data)
        }
        matrix.push(row)
    }
    MATRIX.push(...matrix.flat())
}

async function compute_colors() {
    print('Computing colors')
    const a1 = MATRIX.find((v) => v.position === 'a1')
    const a6 = MATRIX.find((v) => v.position === 'a6')
    const a7 = MATRIX.find((v) => v.position === 'a7')
    const a8 = MATRIX.find((v) => v.position === 'a8')
    const b7 = MATRIX.find((v) => v.position === 'b7')
    COMPUTED_COLORS.white = robot.getPixelColor(a1.piece.x, a1.piece.y)
    COMPUTED_COLORS.black = robot.getPixelColor(a8.piece.x, a8.piece.y)

    robot.moveMouse(a6.x, a6.y)
    await sleep(250)
    robot.mouseClick()

    for await (const color of ['light_highlight', 'dark_highlight']) {
        const { x, y } = color === 'light_highlight' ? b7 : a7
        await sleep(250)
        robot.moveMouse(x, y)
        await sleep(250)
        robot.mouseClick()
        await sleep(250)
        COMPUTED_COLORS[color] = robot.getPixelColor(x, y)
    }

    robot.moveMouse(a7.x, a7.y)
    await sleep(250)
    robot.mouseClick()

    print('Done computing')
    print(`Light highlight: #${COMPUTED_COLORS.light_highlight}`)
    print(`Dark highlight: #${COMPUTED_COLORS.dark_highlight}`)
    print(`White pieces: #${COMPUTED_COLORS.white}`)
    print(`Black pieces: #${COMPUTED_COLORS.black}`)
}

function find_playing_color(x, y, size) {
    const true_x = size / 2 + x
    const true_y = size / 2 + y
    const color = robot.getPixelColor(true_x, true_y)
    const colors = {
        white: '#ffffff',
        black: '#000000',
    }
    const nearest_color = require('nearest-color').from(colors)
    if (nearest_color(color).name === 'black') {
        PLAY.color = 'white'
        print('Playing as white')
    } else if (nearest_color(color).name === 'white') {
        PLAY.color = 'black'
        print('Playing as black')
    }
}

function write(string) {
    process.stdin.write(string + '\n')
}

async function go(first_move = false) {
    const wait_time_ms = random_from_interval(CONFIG.wait_time_ms.min, CONFIG.wait_time_ms.max)
    if (!first_move) {
        print(`Sleeping for ${(wait_time_ms / 1000).toFixed(2)}s`)
        await sleep(wait_time_ms)
    }
    write('go movetime 1000')
}

function random_from_interval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

async function wait() {
    print('Waiting on opponent')
    const moves = []
    for (const data of MATRIX) {
        const color = robot.getPixelColor(data.x, data.y)
        const colors = {
            light_square: CONFIG.colors.light_square.toLowerCase(),
            dark_square: CONFIG.colors.dark_square.toLowerCase(),
            light_highlight: COMPUTED_COLORS.light_highlight,
            dark_highlight: COMPUTED_COLORS.dark_highlight,
        }
        const nearest_color = require('nearest-color').from(colors)
        if (nearest_color(color).name.includes('highlight')) {
            const color = robot.getPixelColor(data.piece.x, data.piece.y)
            const colors = {
                light_highlight: COMPUTED_COLORS.light_highlight,
                dark_highlight: COMPUTED_COLORS.dark_highlight,
                white: COMPUTED_COLORS.white,
                black: COMPUTED_COLORS.black,
            }
            const nearest_color = require('nearest-color').from(colors)
            if (nearest_color(color).name.includes('highlight')) {
                moves.unshift(data.position)
            } else {
                const opposite_color = PLAY.color === 'white' ? 'black' : 'white'
                if (nearest_color(color).name.includes(opposite_color)) {
                    moves.push(data.position)
                }
            }
        }
    }
    const last_move = STOCKFISH.at(-1) === moves.join('')
    if (moves.length === 2 && !last_move) {
        await play_opponent_move(moves)
        go()
    } else {
        await sleep(1000)
        wait()
    }
}

function start_playing() {
    if (PLAY.color === 'white') {
        go(true)
    } else {
        wait()
    }
}

async function play_opponent_move(moves) {
    const [first_move, second_move] = moves

    const first_dataset = MATRIX.find((x) => x.position === first_move)
    const second_dataset = MATRIX.find((x) => x.position === second_move)

    print(`Opponent played: ${first_move}${second_move}`)
    STOCKFISH.push(moves.join(''))
    write(STOCKFISH.join(' '))
    write('d')
}

async function play_move(best_move, mate) {
    STOCKFISH.push(best_move)
    write(STOCKFISH.join(' '))
    write('d')

    const first_move = best_move.slice(0, 2)
    const second_move = best_move.slice(2, 4)

    const first_dataset = MATRIX.find((x) => x.position === first_move)
    const second_dataset = MATRIX.find((x) => x.position === second_move)

    await drag_and_drop(first_dataset.x, first_dataset.y, second_dataset.x, second_dataset.y)

    if (mate) {
        print('Check mate')
    } else {
        await wait()
    }
}

async function drag_and_drop(from_x, from_y, to_x, to_y) {
    await sleep(200)
    robot.moveMouse(from_x, from_y)
    await sleep(200)
    robot.mouseClick()
    await sleep(200)
    robot.mouseToggle('down')
    await sleep(200)
    robot.dragMouse(to_x, to_y)
    await sleep(200)
    robot.mouseToggle('up')
}

run()

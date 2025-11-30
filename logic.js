let board = []
let selectedCell = null
let leftCount = Array(10).fill(9)
let ws
const boardDiv = document.getElementById('board')
const pad = document.getElementById('numberPad')
const playersUl = document.getElementById('playersUl')
let player

initUI()

async function connectToWs(nickname, color) {
  const backendUrl = new URLSearchParams(document.location.search).get('url')

  ws = new WebSocket(backendUrl)

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', nickname, color }))
  }

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data)
    if (data.type === 'state') {
      board = data.board
      playersUl.innerHTML = ''
      data.players.forEach(addPlayer)
      renderBoard()
    }
    if (data.type == 'player-leave') {
      console.log(data)
      document.getElementById(data.nickname + data.color)?.remove()
    }
    if (data.type == 'new-player') {
      console.log(data)
      addPlayer(data)
    }
    if (data.type === 'update') {
      document
        .getElementById(data.nickname + data.color)
        .querySelector(
          'span:last-child'
        ).textContent = `${data.nickname} - ${data.count}`
      updateCell(data.row, data.col, data.value, data.correct, data.color)
    }
  }
}

function addPlayer(p) {
  const li = document.createElement('li')
  li.id = p.nickname + p.color
  li.classList.add('pop')
  const dot = document.createElement('span')
  dot.className = 'colorDot'
  dot.style.backgroundColor = p.color
  li.appendChild(dot)
  const text = document.createElement('span')
  text.textContent = `${p.nickname} - ${p.count}`
  li.appendChild(text)
  playersUl.appendChild(li)
}

function initUI() {
  const nicknameInput = document.getElementById('nickname')
  const colorInput = document.getElementById('color')
  const enterBtn = document.getElementById('enterGame')
  const popup = document.getElementById('loginPopup')

  const randomColor = `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`
  colorInput.value = randomColor

  enterBtn.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim()
    const color = colorInput.value
    if (!nickname) return alert('Введите никнейм!')

    connectToWs(nickname, color)
    player = { nickname, color, count: 0 }
    popup.style.display = 'none'
  })

  initTheme()

  document.getElementById('newGame').onclick = () => {
    ws.send(JSON.stringify({ type: 'new', difficulty: difficulty.value }))
  }
}

function initTheme() {
  if (localStorage.getItem('theme') == 'dark')
    document.documentElement.classList.add('dark')
  const btn = document.getElementById('themeToggle')
  btn.onclick = () => {
    if (localStorage.getItem('theme') == 'dark')
      localStorage.setItem('theme', 'light')
    else localStorage.setItem('theme', 'dark')
    document.documentElement.classList.toggle('dark')
  }
}

function sendUpdate(r, c, v) {
  ws.send(
    JSON.stringify({
      type: 'update',
      row: r,
      col: c,
      value: v,
      ...player,
    })
  )
}

function renderBoard() {
  boardDiv.innerHTML = ''
  leftCount = Array(10).fill(9)

  const blocks = Array.from({ length: 9 }, () => {
    const block = document.createElement('div')
    block.classList.add('block')
    boardDiv.appendChild(block)
    return block
  })

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = board[r][c].value
      if (val) leftCount[val]--

      const cell = document.createElement('div')
      cell.className = 'cell'
      if (c === 2 || c === 5) cell.classList.add('block-right')
      if (r === 2 || r === 5) cell.classList.add('block-bottom')
      if (board[r][c].fixed) cell.classList.add('fixed')
      else if (board[r][c].value) cell.classList.add('solved')
      cell.textContent = val || ''
      cell.dataset.r = r
      cell.dataset.c = c
      cell.onclick = () =>
        selectCell(r, c, board[r][c].fixed || board[r][c].solved)

      if (board[r][c].color)
        cell.style.backgroundColor = hexToRgba(board[r][c].color)

      const i = Math.floor(r / 3) * 3 + Math.floor(c / 3)
      blocks[i].appendChild(cell)
    }
  }
  renderNumberPad()
}

function hexToRgba(hex) {
  hex = hex.replace(/^#/, '')

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }

  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${0.3})`
}

function getCell(idx) {
  const r = Math.floor(idx / 9),
    c = idx % 9
  const blockIndex = Math.floor(r / 3) * 3 + Math.floor(c / 3)
  const cellIndex = (r % 3) * 3 + (c % 3)
  return boardDiv.children[blockIndex]?.children[cellIndex] ?? null
}

function updateCell(r, c, value, correct, color) {
  const idx = r * 9 + c
  const cell = getCell(idx)
  const old = board[r][c].value

  if (correct) {
    board[r][c].value = value
    board[r][c].fixed = true
    board[r][c].solved = true
    board[r][c].color = color

    if (old) leftCount[old]++
    if (value) leftCount[value]--

    cell.textContent = value || ''
    cell.classList.remove('wrong')
    cell.classList.add('solved', 'pop')
    cell.style.backgroundColor = hexToRgba(color)

    if (selectedCell && selectedCell.r == r && selectedCell.c == c) {
      selectedCell = null
      clearSelectionVisuals()
      highlightSame(board[r][c].value)
    }
  } else {
    cell.textContent = value
    cell.classList.add('wrong')
    setTimeout(() => {
      if (cell) {
        cell.classList.remove('wrong')
        cell.textContent = board[r][c].value || ''
      }
    }, 1400)
  }
  renderNumberPad()
}

function selectCell(r, c, fixed) {
  if (fixed) {
    selectedCell = null
    clearSelectionVisuals()
    highlightSame(board[r][c].value)
    return
  }
  selectedCell = { r, c }
  clearSelectionVisuals()
  const cell = getCell(r * 9 + c)
  if (!board[r][c].value) cell.classList.add('selected-empty')
  cell.classList.add('selected')
  highlightSame(board[r][c].value)
}

function clearSelectionVisuals() {
  for (let i = 0; i < 81; i++) {
    const cell = getCell(i)
    cell.classList.remove('selected', 'selected-empty', 'highlight')
    cell.style.opacity = ''
  }
}

function highlightSame(num) {
  if (!num) return
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      if (board[r][c].value === num) {
        getCell(r * 9 + c).classList.add('highlight')
      }
    }
}

function renderNumberPad() {
  pad.innerHTML = ''
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button')
    btn.className = 'num-btn'
    btn.innerHTML = `<span>${n}</span><small>${leftCount[n]}</small>`
    btn.disabled = leftCount[n] <= 0

    btn.onclick = () => {
      btn.classList.add('active')
      setTimeout(() => btn.classList.remove('active'), 700)

      if (
        !selectedCell ||
        getCell(selectedCell.r * 9 + selectedCell.c).classList.contains(
          'solved'
        )
      ) {
        selectedCell = null
        clearSelectionVisuals()
        highlightSame(n)
      }
      placeNumber(n)
    }
    pad.appendChild(btn)
  }
}

function placeNumber(n) {
  if (!selectedCell) return
  const { r, c } = selectedCell
  if (board[r][c].fixed || board[r][c].solved) return
  sendUpdate(r, c, n)
}

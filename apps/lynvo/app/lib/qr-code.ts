/**
 * A small, self-contained QR Code Model 2 encoder.
 *
 * Lynvo only needs byte-mode QR codes with medium error correction for short
 * activation URLs, so this module intentionally keeps one encoding mode and
 * one error-correction level.
 */

export type QrCodeModules = readonly (readonly boolean[])[]

const MEDIUM_ECC_CODEWORDS_PER_BLOCK = [
  0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26,
  26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  28, 28, 28,
] as const

const MEDIUM_BLOCKS = [
  0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17,
  18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
] as const

const appendBits = (value: number, length: number, bits: number[]) => {
  if (length < 0 || length > 31 || value < 0 || value >= 2 ** length) {
    throw new RangeError("QR bit value is out of range")
  }

  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1)
  }
}

const getBit = (value: number, index: number) => ((value >>> index) & 1) !== 0

const getNumRawDataModules = (version: number) => {
  let result = (16 * version + 128) * version + 64

  if (version >= 2) {
    const alignmentCount = Math.floor(version / 7) + 2
    result -= (25 * alignmentCount - 10) * alignmentCount - 55

    if (version >= 7) {
      result -= 36
    }
  }

  return result
}

const getNumDataCodewords = (version: number) =>
  Math.floor(getNumRawDataModules(version) / 8) -
  MEDIUM_ECC_CODEWORDS_PER_BLOCK[version] * MEDIUM_BLOCKS[version]

const encodeDataCodewords = (bytes: Uint8Array, version: number) => {
  const capacityBits = getNumDataCodewords(version) * 8
  const bits: number[] = []

  appendBits(0b0100, 4, bits)
  appendBits(bytes.length, version < 10 ? 8 : 16, bits)

  for (const byte of bytes) {
    appendBits(byte, 8, bits)
  }

  appendBits(0, Math.min(4, capacityBits - bits.length), bits)
  appendBits(0, (8 - (bits.length % 8)) % 8, bits)

  let padByte = 0xec
  while (bits.length < capacityBits) {
    appendBits(padByte, 8, bits)
    padByte ^= 0xec ^ 0x11
  }

  const codewords = Array.from({ length: capacityBits / 8 }, () => 0)
  bits.forEach((bit, index) => {
    codewords[index >>> 3] |= bit << (7 - (index & 7))
  })

  return codewords
}

const reedSolomonMultiply = (left: number, right: number) => {
  let result = 0

  for (let index = 7; index >= 0; index -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d)
    result ^= ((right >>> index) & 1) * left
  }

  return result
}

const reedSolomonDivisor = (degree: number) => {
  const result = Array.from({ length: degree - 1 }, () => 0)
  result.push(1)

  let root = 1
  for (let index = 0; index < degree; index += 1) {
    for (let coefficient = 0; coefficient < result.length; coefficient += 1) {
      result[coefficient] = reedSolomonMultiply(result[coefficient], root)

      if (coefficient + 1 < result.length) {
        result[coefficient] ^= result[coefficient + 1]
      }
    }

    root = reedSolomonMultiply(root, 2)
  }

  return result
}

const reedSolomonRemainder = (data: readonly number[], divisor: number[]) => {
  const result = Array.from({ length: divisor.length }, () => 0)

  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0)
    result.push(0)

    divisor.forEach((coefficient, index) => {
      result[index] ^= reedSolomonMultiply(coefficient, factor)
    })
  }

  return result
}

interface ErrorCorrectionBlocks {
  readonly blocks: number[][]
  readonly rawCodewords: number
  readonly layout: ErrorCorrectionLayout
}

interface ErrorCorrectionLayout {
  readonly shortBlockCount: number
  readonly shortBlockLength: number
  readonly eccCodewordsPerBlock: number
}

const buildErrorCorrectionBlocks = (
  data: readonly number[],
  version: number
): ErrorCorrectionBlocks => {
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8)
  const blockCount = MEDIUM_BLOCKS[version]
  const eccCodewordsPerBlock = MEDIUM_ECC_CODEWORDS_PER_BLOCK[version]
  const shortBlockCount = blockCount - (rawCodewords % blockCount)
  const shortBlockLength = Math.floor(rawCodewords / blockCount)
  const divisor = reedSolomonDivisor(eccCodewordsPerBlock)
  const blocks: number[][] = []
  let dataOffset = 0

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
    const dataLength =
      shortBlockLength -
      eccCodewordsPerBlock +
      (blockIndex < shortBlockCount ? 0 : 1)
    const blockData = data.slice(dataOffset, dataOffset + dataLength)
    dataOffset += dataLength

    const ecc = reedSolomonRemainder(blockData, divisor)
    if (blockIndex < shortBlockCount) {
      blockData.push(0)
    }

    blocks.push(blockData.concat(ecc))
  }

  return {
    blocks,
    rawCodewords,
    layout: {
      shortBlockCount,
      shortBlockLength,
      eccCodewordsPerBlock,
    },
  }
}

const interleaveErrorCorrectionBlocks = (
  blocks: readonly number[][],
  layout: ErrorCorrectionLayout
) => {
  const result: number[] = []
  const [firstBlock] = blocks
  for (let index = 0; index < firstBlock.length; index += 1) {
    blocks.forEach((block, blockIndex) => {
      if (index !== layout.shortBlockLength - layout.eccCodewordsPerBlock) {
        result.push(block[index])
      } else if (blockIndex >= layout.shortBlockCount) {
        result.push(block[index])
      }
    })
  }

  return result
}

const addErrorCorrectionAndInterleave = (
  data: readonly number[],
  version: number
) => {
  const { rawCodewords, blocks, layout } = buildErrorCorrectionBlocks(
    data,
    version
  )
  const result = interleaveErrorCorrectionBlocks(blocks, layout)

  if (result.length !== rawCodewords) {
    throw new Error("QR error-correction interleave failed")
  }

  return result
}

const alignmentPatternPositions = (version: number) => {
  if (version === 1) {
    return []
  }

  const alignmentCount = Math.floor(version / 7) + 2
  const step =
    version === 32
      ? 26
      : Math.ceil((version * 4 + 4) / (alignmentCount * 2 - 2)) * 2
  const size = version * 4 + 17
  const positions = [6]

  for (
    let position = size - 7;
    positions.length < alignmentCount;
    position -= step
  ) {
    positions.splice(1, 0, position)
  }

  return positions
}

// oxlint-disable-next-line max-params -- QR layout primitives keep both matrix buffers and coordinates explicit.
const drawFunctionModule = (
  modules: boolean[][],
  functionModules: boolean[][],
  x: number,
  y: number,
  dark: boolean
) => {
  modules[y][x] = dark
  functionModules[y][x] = true
}

// oxlint-disable-next-line max-params -- QR layout primitives keep both matrix buffers and coordinates explicit.
const drawFinderPattern = (
  modules: boolean[][],
  functionModules: boolean[][],
  centerX: number,
  centerY: number
) => {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = centerX + dx
      const y = centerY + dy

      if (x < 0 || y < 0 || y >= modules.length || x >= modules.length) {
        continue
      }

      const distance = Math.max(Math.abs(dx), Math.abs(dy))
      drawFunctionModule(
        modules,
        functionModules,
        x,
        y,
        distance !== 2 && distance !== 4
      )
    }
  }
}

// oxlint-disable-next-line max-params -- QR layout primitives keep both matrix buffers and coordinates explicit.
const drawAlignmentPattern = (
  modules: boolean[][],
  functionModules: boolean[][],
  centerX: number,
  centerY: number
) => {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      drawFunctionModule(
        modules,
        functionModules,
        centerX + dx,
        centerY + dy,
        Math.max(Math.abs(dx), Math.abs(dy)) !== 1
      )
    }
  }
}

const drawFormatBits = (
  modules: boolean[][],
  functionModules: boolean[][],
  mask: number
) => {
  let remainder = mask
  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537)
  }

  const bits = ((mask << 10) | remainder) ^ 0x5412
  const size = modules.length

  for (let index = 0; index <= 5; index += 1) {
    drawFunctionModule(modules, functionModules, 8, index, getBit(bits, index))
  }
  drawFunctionModule(modules, functionModules, 8, 7, getBit(bits, 6))
  drawFunctionModule(modules, functionModules, 8, 8, getBit(bits, 7))
  drawFunctionModule(modules, functionModules, 7, 8, getBit(bits, 8))

  for (let index = 9; index < 15; index += 1) {
    drawFunctionModule(
      modules,
      functionModules,
      14 - index,
      8,
      getBit(bits, index)
    )
  }

  for (let index = 0; index < 8; index += 1) {
    drawFunctionModule(
      modules,
      functionModules,
      size - 1 - index,
      8,
      getBit(bits, index)
    )
  }

  for (let index = 8; index < 15; index += 1) {
    drawFunctionModule(
      modules,
      functionModules,
      8,
      size - 15 + index,
      getBit(bits, index)
    )
  }

  drawFunctionModule(modules, functionModules, 8, size - 8, true)
}

const drawVersionBits = (
  modules: boolean[][],
  functionModules: boolean[][],
  version: number
) => {
  if (version < 7) {
    return
  }

  let remainder = version
  for (let index = 0; index < 12; index += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25)
  }

  const bits = (version << 12) | remainder
  const size = modules.length

  for (let index = 0; index < 18; index += 1) {
    const dark = getBit(bits, index)
    const x = size - 11 + (index % 3)
    const y = Math.floor(index / 3)
    drawFunctionModule(modules, functionModules, x, y, dark)
    drawFunctionModule(modules, functionModules, y, x, dark)
  }
}

const drawFunctionPatterns = (
  modules: boolean[][],
  functionModules: boolean[][],
  version: number
) => {
  const size = modules.length

  for (let index = 0; index < size; index += 1) {
    drawFunctionModule(modules, functionModules, 6, index, index % 2 === 0)
    drawFunctionModule(modules, functionModules, index, 6, index % 2 === 0)
  }

  drawFinderPattern(modules, functionModules, 3, 3)
  drawFinderPattern(modules, functionModules, size - 4, 3)
  drawFinderPattern(modules, functionModules, 3, size - 4)

  const positions = alignmentPatternPositions(version)
  for (let row = 0; row < positions.length; row += 1) {
    for (let column = 0; column < positions.length; column += 1) {
      const isCorner =
        (row === 0 && column === 0) ||
        (row === 0 && column === positions.length - 1) ||
        (row === positions.length - 1 && column === 0)

      if (!isCorner) {
        drawAlignmentPattern(
          modules,
          functionModules,
          positions[column],
          positions[row]
        )
      }
    }
  }

  drawFormatBits(modules, functionModules, 0)
  drawVersionBits(modules, functionModules, version)
}

const drawCodewords = (
  modules: boolean[][],
  functionModules: boolean[][],
  codewords: readonly number[]
) => {
  const size = modules.length
  let bitIndex = 0

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5
    }

    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let column = 0; column < 2; column += 1) {
        const x = right - column
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vertical : vertical

        if (!functionModules[y][x] && bitIndex < codewords.length * 8) {
          modules[y][x] = getBit(codewords[bitIndex >>> 3], 7 - (bitIndex & 7))
          bitIndex += 1
        }
      }
    }
  }

  if (bitIndex !== codewords.length * 8) {
    throw new Error("QR data placement failed")
  }
}

const shouldMaskModule = (mask: number, x: number, y: number) => {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      throw new RangeError("QR mask is out of range")
  }
}

const applyMask = (
  modules: boolean[][],
  functionModules: boolean[][],
  mask: number
) => {
  for (let y = 0; y < modules.length; y += 1) {
    for (let x = 0; x < modules.length; x += 1) {
      if (!functionModules[y][x] && shouldMaskModule(mask, x, y)) {
        modules[y][x] = !modules[y][x]
      }
    }
  }
}

const countFinderPatterns = (history: readonly number[]) => {
  const [, moduleCount] = history
  const core =
    moduleCount > 0 &&
    history[2] === moduleCount &&
    history[3] === moduleCount * 3 &&
    history[4] === moduleCount &&
    history[5] === moduleCount

  return (
    (core && history[0] >= moduleCount * 4 && history[6] >= moduleCount
      ? 1
      : 0) +
    (core && history[6] >= moduleCount * 4 && history[0] >= moduleCount ? 1 : 0)
  )
}

const addFinderHistory = (
  runLength: number,
  history: number[],
  lineLength: number
) => {
  if (history[0] === 0) {
    runLength += lineLength
  }

  history.pop()
  history.unshift(runLength)
}

const scoreLine = (line: readonly boolean[]) => {
  let score = 0
  let runColor = false
  let runLength = 0
  const history = [0, 0, 0, 0, 0, 0, 0]

  for (const color of line) {
    if (color === runColor) {
      runLength += 1
      if (runLength === 5) {
        score += 3
      } else if (runLength > 5) {
        score += 1
      }
    } else {
      addFinderHistory(runLength, history, line.length)
      if (!runColor) {
        score += countFinderPatterns(history) * 40
      }
      runColor = color
      runLength = 1
    }
  }

  if (runColor) {
    addFinderHistory(runLength, history, line.length)
    runLength = 0
  }

  addFinderHistory(runLength + line.length, history, line.length)
  return score + countFinderPatterns(history) * 40
}

const scoreAdjacentSquares = (modules: boolean[][]) => {
  let score = 0
  const size = modules.length

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = modules[y][x]
      if (
        color === modules[y][x + 1] &&
        color === modules[y + 1][x] &&
        color === modules[y + 1][x + 1]
      ) {
        score += 3
      }
    }
  }

  return score
}

const scoreDarkBalance = (modules: boolean[][]) => {
  let darkModules = 0
  const size = modules.length

  for (const row of modules) {
    for (const module of row) {
      if (module) {
        darkModules += 1
      }
    }
  }

  const totalModules = size * size
  return (
    (Math.ceil(Math.abs(darkModules * 20 - totalModules * 10) / totalModules) -
      1) *
    10
  )
}

const getMaskPenalty = (modules: boolean[][]) => {
  let score = 0
  const size = modules.length

  for (let y = 0; y < size; y += 1) {
    score += scoreLine(modules[y])
  }

  for (let x = 0; x < size; x += 1) {
    const column = modules.map((row) => row[x])
    score += scoreLine(column)
  }

  return score + scoreAdjacentSquares(modules) + scoreDarkBalance(modules)
}

const chooseMask = (modules: boolean[][], functionModules: boolean[][]) => {
  let bestMask = 0
  let bestScore = Number.POSITIVE_INFINITY

  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(modules, functionModules, mask)
    drawFormatBits(modules, functionModules, mask)
    const score = getMaskPenalty(modules)

    if (score < bestScore) {
      bestScore = score
      bestMask = mask
    }

    applyMask(modules, functionModules, mask)
  }

  applyMask(modules, functionModules, bestMask)
  drawFormatBits(modules, functionModules, bestMask)
}

const getVersionForBytes = (bytes: Uint8Array) => {
  for (let version = 1; version <= 40; version += 1) {
    const countBits = version < 10 ? 8 : 16
    const usedBits = 4 + countBits + bytes.length * 8

    if (usedBits <= getNumDataCodewords(version) * 8) {
      return version
    }
  }

  throw new RangeError("QR code data is too long")
}

export const encodeQrCode = (value: string): QrCodeModules => {
  if (
    Array.from(value).some(
      (character) => (character.codePointAt(0) ?? 0) > 0x7f
    )
  ) {
    throw new RangeError("QR code only supports ASCII values")
  }

  const bytes = new TextEncoder().encode(value)
  const version = getVersionForBytes(bytes)
  const size = version * 4 + 17
  const modules = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  )
  const functionModules = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  )

  drawFunctionPatterns(modules, functionModules, version)

  const dataCodewords = encodeDataCodewords(bytes, version)
  const allCodewords = addErrorCorrectionAndInterleave(dataCodewords, version)
  drawCodewords(modules, functionModules, allCodewords)
  chooseMask(modules, functionModules)

  return modules
}

"use strict";

const CowSudokuCore = (() => {
  const COLOR_POOL = [
    { name: "红", value: "#ec7468" },
    { name: "橙", value: "#ffc357" },
    { name: "黄", value: "#dfe277" },
    { name: "绿", value: "#9ed38b" },
    { name: "青", value: "#63bdd7" },
    { name: "蓝", value: "#8098d3" },
    { name: "紫", value: "#b4a2cc" },
    { name: "粉", value: "#efa5bc" },
    { name: "灰", value: "#aeb7c4" },
  ];

  const ORTHO_DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const KING_DIRS = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  function randomInt(min, max, rng = Math.random) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function shuffle(items, rng = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function cellKey(row, col) {
    return `${row},${col}`;
  }

  function inBounds(row, col, n) {
    return row >= 0 && row < n && col >= 0 && col < n;
  }

  function allCells(n) {
    const cells = [];
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        cells.push({ row, col });
      }
    }
    return cells;
  }

  function cloneRegions(regions) {
    return regions.map((row) => row.slice());
  }

  function regionSizes(regions, n) {
    const sizes = Array(n).fill(0);
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        sizes[regions[row][col]] += 1;
      }
    }
    return sizes;
  }

  function hasCowAt(cows, row, col) {
    return cows.some((cow) => cow.row === row && cow.col === col);
  }

  function generateCowPositions(n, rng = Math.random) {
    for (let restart = 0; restart < 120; restart += 1) {
      const columns = [];
      const used = new Set();

      function place(row) {
        if (row === n) {
          return true;
        }

        const candidates = shuffle(
          Array.from({ length: n }, (_, index) => index),
          rng
        ).filter((col) => {
          if (used.has(col)) {
            return false;
          }
          return row === 0 || Math.abs(col - columns[row - 1]) > 1;
        });

        for (const col of candidates) {
          columns[row] = col;
          used.add(col);
          if (place(row + 1)) {
            return true;
          }
          used.delete(col);
          columns.pop();
        }

        return false;
      }

      if (place(0)) {
        return columns.map((col, row) => ({ row, col, region: row }));
      }
    }

    throw new Error(`无法生成 ${n}x${n} 的小牛位置`);
  }

  function generateRegions(n, cows, rng = Math.random) {
    const grid = Array.from({ length: n }, () => Array(n).fill(-1));
    const frontiers = Array.from({ length: n }, () => []);
    let assigned = 0;

    for (const cow of cows) {
      grid[cow.row][cow.col] = cow.region;
      frontiers[cow.region].push({ row: cow.row, col: cow.col });
      assigned += 1;
    }

    while (assigned < n * n) {
      const liveRegions = frontiers
        .map((frontier, region) => ({ frontier, region }))
        .filter(({ frontier }) => frontier.length > 0);

      if (liveRegions.length === 0) {
        throw new Error("颜色区域扩张失败");
      }

      const selected = liveRegions[Math.floor(rng() * liveRegions.length)];
      const frontierIndex = Math.floor(rng() * selected.frontier.length);
      const source = selected.frontier[frontierIndex];
      const options = shuffle(ORTHO_DIRS, rng)
        .map(([dr, dc]) => ({ row: source.row + dr, col: source.col + dc }))
        .filter(({ row, col }) => inBounds(row, col, n) && grid[row][col] === -1);

      if (options.length === 0) {
        selected.frontier.splice(frontierIndex, 1);
        continue;
      }

      const next = options[0];
      grid[next.row][next.col] = selected.region;
      selected.frontier.push(next);
      assigned += 1;
    }

    return grid;
  }

  function buildGroups(puzzle) {
    const { n, regions } = puzzle;
    const groups = [];

    for (let row = 0; row < n; row += 1) {
      groups.push({
        type: "row",
        index: row,
        cells: Array.from({ length: n }, (_, col) => ({ row, col })),
      });
    }

    for (let col = 0; col < n; col += 1) {
      groups.push({
        type: "col",
        index: col,
        cells: Array.from({ length: n }, (_, row) => ({ row, col })),
      });
    }

    for (let region = 0; region < n; region += 1) {
      const cells = [];
      for (let row = 0; row < n; row += 1) {
        for (let col = 0; col < n; col += 1) {
          if (regions[row][col] === region) {
            cells.push({ row, col });
          }
        }
      }
      groups.push({ type: "region", index: region, cells });
    }

    return groups;
  }

  function isRegionConnected(regions, region, n) {
    let start = null;
    let targetCount = 0;

    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (regions[row][col] === region) {
          targetCount += 1;
          start = start || { row, col };
        }
      }
    }

    if (!start) {
      return false;
    }

    const queue = [start];
    const seen = new Set([cellKey(start.row, start.col)]);

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const [dr, dc] of ORTHO_DIRS) {
        const nextRow = current.row + dr;
        const nextCol = current.col + dc;
        const key = cellKey(nextRow, nextCol);
        if (
          inBounds(nextRow, nextCol, n) &&
          regions[nextRow][nextCol] === region &&
          !seen.has(key)
        ) {
          seen.add(key);
          queue.push({ row: nextRow, col: nextCol });
        }
      }
    }

    return seen.size === targetCount;
  }

  function validatePuzzle(puzzle) {
    const { n, cows, regions, colors } = puzzle;
    const errors = [];
    const cowKeys = new Set();
    const rowCounts = Array(n).fill(0);
    const colCounts = Array(n).fill(0);
    const regionCowCounts = Array(n).fill(0);
    const regionCellCounts = Array(n).fill(0);

    if (!Number.isInteger(n) || n < 6 || n > 9) {
      errors.push("n 必须在 6 到 9 之间");
    }
    if (!Array.isArray(colors) || colors.length !== n) {
      errors.push("颜色数量必须等于 n");
    }
    if (!Array.isArray(cows) || cows.length !== n) {
      errors.push("小牛数量必须等于 n");
    }

    for (const cow of cows || []) {
      if (!inBounds(cow.row, cow.col, n)) {
        errors.push("小牛位置越界");
        continue;
      }
      const key = cellKey(cow.row, cow.col);
      if (cowKeys.has(key)) {
        errors.push("小牛位置重复");
      }
      cowKeys.add(key);
      rowCounts[cow.row] += 1;
      colCounts[cow.col] += 1;
    }

    for (let i = 0; i < n; i += 1) {
      if (rowCounts[i] !== 1) {
        errors.push(`第 ${i + 1} 行小牛数量不是 1`);
      }
      if (colCounts[i] !== 1) {
        errors.push(`第 ${i + 1} 列小牛数量不是 1`);
      }
    }

    for (let a = 0; a < cows.length; a += 1) {
      for (let b = a + 1; b < cows.length; b += 1) {
        const rowDistance = Math.abs(cows[a].row - cows[b].row);
        const colDistance = Math.abs(cows[a].col - cows[b].col);
        if (rowDistance <= 1 && colDistance <= 1) {
          errors.push("存在相邻小牛");
        }
      }
    }

    if (!Array.isArray(regions) || regions.length !== n) {
      errors.push("颜色区域网格行数不正确");
    } else {
      for (let row = 0; row < n; row += 1) {
        if (!Array.isArray(regions[row]) || regions[row].length !== n) {
          errors.push(`第 ${row + 1} 行颜色区域长度不正确`);
          continue;
        }

        for (let col = 0; col < n; col += 1) {
          const region = regions[row][col];
          if (!Number.isInteger(region) || region < 0 || region >= n) {
            errors.push("颜色区域编号越界");
            continue;
          }
          regionCellCounts[region] += 1;
          if (cowKeys.has(cellKey(row, col))) {
            regionCowCounts[region] += 1;
          }
        }
      }
    }

    for (let region = 0; region < n; region += 1) {
      if (regionCellCounts[region] < 1) {
        errors.push(`颜色 ${region + 1} 没有格子`);
      }
      if (regionCowCounts[region] !== 1) {
        errors.push(`颜色 ${region + 1} 小牛数量不是 1`);
      }
      if (regionCellCounts[region] > 0 && !isRegionConnected(regions, region, n)) {
        errors.push(`颜色 ${region + 1} 不连通`);
      }
    }

    return {
      ok: errors.length === 0,
      errors,
    };
  }

  function validateRegionSizePolicy(puzzle) {
    const sizes = regionSizes(puzzle.regions, puzzle.n);
    const singletonCount = sizes.filter((size) => size === 1).length;
    const undersizedCount = sizes.filter((size) => size > 1 && size < 3).length;
    const exactThreeCount = sizes.filter((size) => size === 3).length;
    const maxSize = Math.max(...sizes);
    const maxAllowedSize = maxRegionSize(puzzle.n);
    const maxExactThreeCount = Math.max(2, puzzle.n - 2);

    return {
      ok:
        singletonCount === 0 &&
        undersizedCount === 0 &&
        maxSize <= maxAllowedSize &&
        exactThreeCount <= maxExactThreeCount,
      sizes,
      singletonCount,
      undersizedCount,
      exactThreeCount,
      maxSize,
      maxAllowedSize,
      maxExactThreeCount,
    };
  }

  function maxRegionSize(n) {
    return Math.ceil(n * n * 0.45);
  }

  function countSolutions(puzzle, limit = 2) {
    const { n, regions } = puzzle;
    const usedCols = Array(n).fill(false);
    const usedRegions = Array(n).fill(false);
    const placements = [];
    let count = 0;

    function canPlace(row, col) {
      if (usedCols[col] || usedRegions[regions[row][col]]) {
        return false;
      }

      return placements.every((cow) => {
        return Math.abs(cow.row - row) > 1 || Math.abs(cow.col - col) > 1;
      });
    }

    function chooseRow() {
      let best = null;
      let bestCandidates = null;

      for (let row = 0; row < n; row += 1) {
        if (placements.some((cow) => cow.row === row)) {
          continue;
        }

        const candidates = [];
        for (let col = 0; col < n; col += 1) {
          if (canPlace(row, col)) {
            candidates.push(col);
          }
        }

        if (!bestCandidates || candidates.length < bestCandidates.length) {
          best = row;
          bestCandidates = candidates;
        }
      }

      return { row: best, candidates: bestCandidates || [] };
    }

    function search() {
      if (count >= limit) {
        return;
      }

      if (placements.length === n) {
        count += 1;
        return;
      }

      const { row, candidates } = chooseRow();
      if (candidates.length === 0) {
        return;
      }

      for (const col of candidates) {
        placements.push({ row, col });
        usedCols[col] = true;
        usedRegions[regions[row][col]] = true;
        search();
        usedCols[col] = false;
        usedRegions[regions[row][col]] = false;
        placements.pop();
      }
    }

    search();
    return count;
  }

  function analyzeLogic(puzzle) {
    const { n, regions } = puzzle;
    const groups = buildGroups(puzzle);
    const status = Array.from({ length: n }, () => Array(n).fill("unknown"));
    const crossSources = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => new Set())
    );
    const steps = [];
    const cowDependencySizes = [];
    let firstPlacementCount = null;
    let firstColorPlacementCount = null;

    function statusAt(cell) {
      return status[cell.row][cell.col];
    }

    function unknownCells(cells) {
      return cells.filter((cell) => statusAt(cell) === "unknown");
    }

    function cowCells(cells) {
      return cells.filter((cell) => statusAt(cell) === "cow");
    }

    function cross(row, col, reason, sources = []) {
      if (!inBounds(row, col, n) || status[row][col] === "cow") {
        return false;
      }

      for (const source of sources) {
        crossSources[row][col].add(source);
      }

      if (status[row][col] !== "unknown") {
        return false;
      }

      status[row][col] = "cross";
      steps.push({ type: "cross", row, col, reason });
      return true;
    }

    function placeCow(row, col, reason, dependencySize = 0) {
      if (!inBounds(row, col, n) || status[row][col] === "cow") {
        return false;
      }
      if (status[row][col] === "cross") {
        return false;
      }

      status[row][col] = "cow";
      cowDependencySizes.push(dependencySize);
      const sourceCow = cellKey(row, col);
      steps.push({ type: "cow", row, col, reason, dependencySize });

      for (let otherCol = 0; otherCol < n; otherCol += 1) {
        if (otherCol !== col) {
          cross(row, otherCol, "same-row", [sourceCow]);
        }
      }
      for (let otherRow = 0; otherRow < n; otherRow += 1) {
        if (otherRow !== row) {
          cross(otherRow, col, "same-col", [sourceCow]);
        }
      }
      const region = regions[row][col];
      for (let r = 0; r < n; r += 1) {
        for (let c = 0; c < n; c += 1) {
          if ((r !== row || c !== col) && regions[r][c] === region) {
            cross(r, c, "same-region", [sourceCow]);
          }
        }
      }
      for (const [dr, dc] of KING_DIRS) {
        cross(row + dr, col + dc, "adjacent", [sourceCow]);
      }

      return true;
    }

    function dependencySourcesFor(group, onlyCell) {
      const sources = new Set();
      for (const cell of group.cells) {
        if (cell.row === onlyCell.row && cell.col === onlyCell.col) {
          continue;
        }

        for (const source of crossSources[cell.row][cell.col]) {
          sources.add(source);
        }
      }
      return sources;
    }

    function contradiction() {
      for (const group of groups) {
        if (cowCells(group.cells).length > 1) {
          return true;
        }
        if (cowCells(group.cells).length === 0 && unknownCells(group.cells).length === 0) {
          return true;
        }
      }
      return false;
    }

    function eliminateByIntersections() {
      let changed = false;
      for (const source of groups) {
        if (cowCells(source.cells).length > 0) {
          continue;
        }

        const candidates = unknownCells(source.cells);
        if (candidates.length < 2) {
          continue;
        }

        const rows = new Set(candidates.map((cell) => cell.row));
        const cols = new Set(candidates.map((cell) => cell.col));
        const regionIds = new Set(candidates.map((cell) => regions[cell.row][cell.col]));

        if (source.type !== "row" && rows.size === 1) {
          const row = candidates[0].row;
          for (let col = 0; col < n; col += 1) {
            const inSource = source.cells.some((cell) => cell.row === row && cell.col === col);
            if (!inSource) {
              changed = cross(row, col, "row-intersection") || changed;
            }
          }
        }

        if (source.type !== "col" && cols.size === 1) {
          const col = candidates[0].col;
          for (let row = 0; row < n; row += 1) {
            const inSource = source.cells.some((cell) => cell.row === row && cell.col === col);
            if (!inSource) {
              changed = cross(row, col, "col-intersection") || changed;
            }
          }
        }

        if (source.type !== "region" && regionIds.size === 1) {
          const region = regions[candidates[0].row][candidates[0].col];
          for (let row = 0; row < n; row += 1) {
            for (let col = 0; col < n; col += 1) {
              const inSource = source.cells.some((cell) => cell.row === row && cell.col === col);
              if (regions[row][col] === region && !inSource) {
                changed = cross(row, col, "region-intersection") || changed;
              }
            }
          }
        }
      }

      return changed;
    }

    function eliminateBySolvedGroups() {
      let changed = false;
      for (const group of groups) {
        const cows = cowCells(group.cells);
        if (cows.length === 1) {
          for (const cell of group.cells) {
            if (cell.row !== cows[0].row || cell.col !== cows[0].col) {
              changed = cross(cell.row, cell.col, "solved-group") || changed;
            }
          }
        }
      }
      return changed;
    }

    function closeCrossDeductions() {
      let changed = true;
      while (changed) {
        changed = false;
        changed = eliminateBySolvedGroups() || changed;
        changed = eliminateByIntersections() || changed;
        if (contradiction()) {
          return false;
        }
      }
      return true;
    }

    while (true) {
      if (!closeCrossDeductions()) {
        return { solved: false, initialBreakthroughs: 0, steps };
      }

      const forced = new Map();
      for (const group of groups) {
        if (cowCells(group.cells).length > 0) {
          continue;
        }

        const candidates = unknownCells(group.cells);
        if (candidates.length === 1) {
          const only = candidates[0];
          const key = cellKey(only.row, only.col);
          const existing = forced.get(key) || {
            row: only.row,
            col: only.col,
            sourceTypes: new Set(),
            dependencySources: new Set(),
          };
          existing.sourceTypes.add(group.type);
          for (const source of dependencySourcesFor(group, only)) {
            existing.dependencySources.add(source);
          }
          forced.set(key, existing);
        }
      }

      if (firstPlacementCount === null) {
        firstPlacementCount = forced.size;
        firstColorPlacementCount = Array.from(forced.values()).filter((cell) =>
          cell.sourceTypes.has("region")
        ).length;
      }

      if (forced.size === 0) {
        break;
      }

      for (const cell of forced.values()) {
        placeCow(
          cell.row,
          cell.col,
          "single-candidate",
          cell.dependencySources.size
        );
      }
    }

    const solved = allCells(n).filter((cell) => statusAt(cell) === "cow").length === n;
    const multiSourcePlacements = cowDependencySizes.filter((size) => size >= 2).length;
    return {
      solved,
      initialBreakthroughs: firstColorPlacementCount || 0,
      initialLogicalBreakthroughs: firstPlacementCount || 0,
      multiSourcePlacements,
      maxDependencySize: Math.max(0, ...cowDependencySizes),
      steps,
    };
  }

  function difficultyFromBreakthroughs(count) {
    if (count <= 1) {
      return "困难";
    }
    if (count <= 3) {
      return "中等";
    }
    return "简单";
  }

  function buildSeedRegions(n, cows, softOpenings) {
    const grid = Array.from({ length: n }, () => Array(n).fill(n - 1));

    for (let index = 0; index < n - 1; index += 1) {
      const cow = cows[index];
      grid[cow.row][cow.col] = index;

      if (index >= softOpenings) {
        const decoyRow = index - 1;
        const decoyCol = cow.col;
        if (decoyRow >= 0) {
          grid[decoyRow][decoyCol] = index;
        }
      }
    }

    const lastCow = cows[n - 1];
    grid[lastCow.row][lastCow.col] = n - 1;
    return grid;
  }

  function canMoveCell(regions, n, row, col, targetRegion, cows, minSourceSize = 3) {
    const sourceRegion = regions[row][col];
    if (sourceRegion === targetRegion || hasCowAt(cows, row, col)) {
      return false;
    }

    const sizes = regionSizes(regions, n);
    if (sizes[sourceRegion] <= minSourceSize) {
      return false;
    }

    const touchesTarget = ORTHO_DIRS.some(([dr, dc]) => {
      const nextRow = row + dr;
      const nextCol = col + dc;
      return (
        inBounds(nextRow, nextCol, n) &&
        regions[nextRow][nextCol] === targetRegion
      );
    });

    if (!touchesTarget) {
      return false;
    }

    const nextRegions = cloneRegions(regions);
    nextRegions[row][col] = targetRegion;
    return (
      isRegionConnected(nextRegions, targetRegion, n) &&
      isRegionConnected(nextRegions, sourceRegion, n)
    );
  }

  function expansionCandidates(regions, n, targetRegion, cows, rng) {
    const candidates = [];
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (canMoveCell(regions, n, row, col, targetRegion, cows)) {
          candidates.push({ row, col });
        }
      }
    }
    return shuffle(candidates, rng);
  }

  function transferCandidates(regions, n, sourceRegion, targetRegion, cows, rng) {
    const candidates = [];
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (
          regions[row][col] === sourceRegion &&
          canMoveCell(regions, n, row, col, targetRegion, cows, 4)
        ) {
          candidates.push({ row, col });
        }
      }
    }
    return shuffle(candidates, rng);
  }

  function puzzleStillGood(puzzle) {
    const validation = validatePuzzle(puzzle);
    if (!validation.ok) {
      return false;
    }
    if (countSolutions(puzzle, 2) !== 1) {
      return false;
    }
    const logic = analyzeLogic(puzzle);
    return logic.solved && logic.initialBreakthroughs >= 1;
  }

  function inflateSmallRegions(n, cows, seedRegions, rng) {
    let regions = cloneRegions(seedRegions);
    let guard = 0;

    while (Math.min(...regionSizes(regions, n)) < 3 && guard < n * n * 5) {
      guard += 1;
      let changed = false;
      const sizes = regionSizes(regions, n);
      const targets = shuffle(
        Array.from({ length: n }, (_, region) => region).filter(
          (region) => sizes[region] < 3
        ),
        rng
      ).sort((a, b) => sizes[a] - sizes[b]);

      for (const targetRegion of targets) {
        const candidates = expansionCandidates(regions, n, targetRegion, cows, rng);

        for (const candidate of candidates) {
          const nextRegions = cloneRegions(regions);
          nextRegions[candidate.row][candidate.col] = targetRegion;
          const puzzle = {
            n,
            cows,
            regions: nextRegions,
            colors: COLOR_POOL.slice(0, n),
          };

          if (puzzleStillGood(puzzle)) {
            regions = nextRegions;
            changed = true;
            break;
          }
        }
      }

      if (!changed) {
        return null;
      }
    }

    return Math.min(...regionSizes(regions, n)) >= 3 ? regions : null;
  }

  function balanceRegionAreas(n, cows, startRegions, rng) {
    let regions = cloneRegions(startRegions);
    let bestRegions = validateRegionSizePolicy({
      n,
      cows,
      regions,
      colors: COLOR_POOL.slice(0, n),
    }).ok
      ? cloneRegions(regions)
      : null;
    let polishMoves = n;

    for (let step = 0; step < n * n * 12; step += 1) {
      const policy = validateRegionSizePolicy({
        n,
        cows,
        regions,
        colors: COLOR_POOL.slice(0, n),
      });

      if (policy.ok) {
        bestRegions = cloneRegions(regions);
        if (polishMoves <= 0) {
          return bestRegions;
        }
        polishMoves -= 1;
      }

      const sizes = policy.sizes;
      const maxSize = Math.max(...sizes);
      const largeRegions = Array.from({ length: n }, (_, region) => region)
        .filter((region) => sizes[region] === maxSize)
        .concat(
          shuffle(
            Array.from({ length: n }, (_, region) => region).filter(
              (region) => sizes[region] > 4
            ),
            rng
          )
        );

      const smallTargets = Array.from({ length: n }, (_, region) => region)
        .filter(
          (region) =>
            sizes[region] === 3 ||
            sizes[region] < Math.max(5, Math.floor((n * n) / n))
        )
        .sort((a, b) => sizes[a] - sizes[b]);
      const targetRegions = shuffle(smallTargets, rng).concat(
        shuffle(
          Array.from({ length: n }, (_, region) => region).filter(
            (region) => sizes[region] < maxRegionSize(n) && sizes[region] !== maxSize
          ),
          rng
        )
      );

      let changed = false;
      for (const sourceRegion of largeRegions) {
        if (sizes[sourceRegion] <= 4) {
          continue;
        }

        for (const targetRegion of targetRegions) {
          if (sourceRegion === targetRegion) {
            continue;
          }

          const candidates = transferCandidates(
            regions,
            n,
            sourceRegion,
            targetRegion,
            cows,
            rng
          );

          for (const candidate of candidates) {
            const nextRegions = cloneRegions(regions);
            nextRegions[candidate.row][candidate.col] = targetRegion;
            const puzzle = {
              n,
              cows,
              regions: nextRegions,
              colors: COLOR_POOL.slice(0, n),
            };

            if (puzzleStillGood(puzzle)) {
              regions = nextRegions;
              changed = true;
              break;
            }
          }

          if (changed) {
            break;
          }
        }

        if (changed) {
          break;
        }
      }

      if (!changed) {
        return bestRegions;
      }
    }

    return bestRegions;
  }

  function generateStructuredRegions(n, cows, rng = Math.random) {
    const attempts = shuffle([0, 1, 2, 3], rng);

    for (const softOpenings of attempts) {
      const seedRegions = buildSeedRegions(n, cows, softOpenings);
      const puzzle = {
        n,
        cows,
        regions: seedRegions,
        colors: COLOR_POOL.slice(0, n),
      };

      if (puzzleStillGood(puzzle)) {
        const inflated = inflateSmallRegions(n, cows, seedRegions, rng);
        if (inflated) {
          const balanced = balanceRegionAreas(n, cows, inflated, rng);
          if (balanced) {
            return balanced;
          }
        }
      }
    }

    return null;
  }

  function generatePuzzle(size, rng = Math.random) {
    const requestedSize = size || randomInt(6, 9, rng);
    const sizes = size
      ? [requestedSize]
      : [
          requestedSize,
          ...shuffle(
            [6, 7, 8, 9].filter((candidate) => candidate !== requestedSize),
            rng
          ),
        ];

    for (const n of sizes) {
      if (!Number.isInteger(n) || n < 6 || n > 9) {
        throw new Error("棋盘尺寸必须是 6 到 9 的整数");
      }

      for (let attempt = 0; attempt < 400; attempt += 1) {
        const cows = generateCowPositions(n, rng);
        const regions = generateStructuredRegions(n, cows, rng);
        if (!regions) {
          continue;
        }

        const colors = shuffle(COLOR_POOL, rng).slice(0, n);
        const puzzle = { n, cows, regions, colors };
        const validation = validatePuzzle(puzzle);

        if (!validation.ok) {
          continue;
        }

        if (countSolutions(puzzle, 2) !== 1) {
          continue;
        }

        const logic = analyzeLogic(puzzle);
        if (!logic.solved || logic.initialBreakthroughs < 1) {
          continue;
        }
        if (logic.multiSourcePlacements < Math.max(1, n - 4)) {
          continue;
        }
        if (!validateRegionSizePolicy(puzzle).ok) {
          continue;
        }

        puzzle.difficulty = difficultyFromBreakthroughs(logic.initialBreakthroughs);
        puzzle.initialBreakthroughs = logic.initialBreakthroughs;
        puzzle.multiSourcePlacements = logic.multiSourcePlacements;
        puzzle.logicSteps = logic.steps.length;
        return puzzle;
      }
    }

    throw new Error("题目生成失败，请重试新局");
  }

  return {
    COLOR_POOL,
    cellKey,
    generateCowPositions,
    generateRegions,
    regionSizes,
    generatePuzzle,
    validatePuzzle,
    validateRegionSizePolicy,
    countSolutions,
    analyzeLogic,
  };
})();

if (typeof module !== "undefined") {
  module.exports = CowSudokuCore;
}

if (typeof window !== "undefined") {
  window.CowSudokuCore = CowSudokuCore;
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    const board = document.querySelector("#board");
    const newGameButton = document.querySelector("#newGameButton");
    const sizeBadge = document.querySelector("#sizeBadge");
    const difficultyBadge = document.querySelector("#difficultyBadge");
    const livesDisplay = document.querySelector("#livesDisplay");
    const remainingCount = document.querySelector("#remainingCount");
    const message = document.querySelector("#message");

    const state = {
      puzzle: null,
      cells: [],
      lives: 3,
      found: 0,
      status: "active",
      tapTimer: 0,
      lastTap: null,
      pointer: null,
    };

    function startGame() {
      setLoading(true);
      window.setTimeout(() => {
        try {
          state.puzzle = CowSudokuCore.generatePuzzle();
          state.cells = Array.from({ length: state.puzzle.n }, () =>
            Array(state.puzzle.n).fill("empty")
          );
          state.lives = 3;
          state.found = 0;
          state.status = "active";
          state.lastTap = null;
          state.pointer = null;
          clearTimeout(state.tapTimer);

          renderBoard();
          syncHud("单击标叉，双击确认小牛，拖动可连续标叉或取消叉。");
        } catch (error) {
          syncHud(error.message || "题目生成失败，请再试一次。", "error");
        } finally {
          setLoading(false);
        }
      }, 20);
    }

    function setLoading(isLoading) {
      newGameButton.disabled = isLoading;
      newGameButton.textContent = isLoading ? "生成中" : "新局";
    }

    function renderBoard() {
      const { n, regions, colors } = state.puzzle;
      board.innerHTML = "";
      board.style.setProperty("--n", String(n));
      board.classList.remove("is-locked");

      for (let row = 0; row < n; row += 1) {
        for (let col = 0; col < n; col += 1) {
          const cell = document.createElement("button");
          const region = regions[row][col];
          cell.type = "button";
          cell.className = "cell";
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          cell.style.backgroundColor = colors[region].value;
          cell.setAttribute("role", "gridcell");
          cell.setAttribute("aria-label", `第 ${row + 1} 行，第 ${col + 1} 列`);
          board.append(cell);
        }
      }
    }

    function syncHud(text, tone = "") {
      sizeBadge.textContent = state.puzzle ? `${state.puzzle.n} x ${state.puzzle.n}` : "- x -";
      difficultyBadge.textContent = state.puzzle
        ? `${state.puzzle.difficulty} · ${state.puzzle.initialBreakthroughs} 个突破口 · ${state.puzzle.multiSourcePlacements} 个联动`
        : "生成中";
      remainingCount.textContent = state.puzzle ? String(state.puzzle.n - state.found) : "0";
      livesDisplay.textContent = "❤ ".repeat(state.lives).trim() || "无";
      message.textContent = text;
      message.classList.toggle("is-error", tone === "error");
      message.classList.toggle("is-success", tone === "success");
      board.classList.toggle("is-locked", state.status !== "active");
    }

    function getCellFromEvent(event) {
      return event.target.closest(".cell");
    }

    function getCellFromPoint(clientX, clientY) {
      const element = document.elementFromPoint(clientX, clientY);
      return element ? element.closest(".cell") : null;
    }

    function readCell(cell) {
      return {
        row: Number(cell.dataset.row),
        col: Number(cell.dataset.col),
      };
    }

    function sameCell(a, b) {
      return a && b && a.row === b.row && a.col === b.col;
    }

    function findCellElement(row, col) {
      return board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    }

    function isCow(row, col) {
      return state.puzzle.cows.some((cow) => cow.row === row && cow.col === col);
    }

    function setCellState(row, col, nextState) {
      if (state.status !== "active" || state.cells[row][col] === "cow") {
        return;
      }
      state.cells[row][col] = nextState;
      paintCell(row, col);
    }

    function toggleCross(row, col) {
      if (state.status !== "active" || state.cells[row][col] === "cow") {
        return;
      }
      setCellState(row, col, state.cells[row][col] === "cross" ? "empty" : "cross");
    }

    function paintCell(row, col) {
      const cell = findCellElement(row, col);
      if (!cell) {
        return;
      }

      cell.innerHTML = "";
      cell.classList.toggle("is-found", state.cells[row][col] === "cow");

      if (state.cells[row][col] === "cross") {
        const cross = document.createElement("span");
        cross.className = "cross-mark";
        cell.append(cross);
      }

      if (state.cells[row][col] === "cow") {
        const cow = document.createElement("span");
        cow.className = "cow-mark";
        cell.append(cow);
      }
    }

    function confirmCow(row, col) {
      if (state.status !== "active" || state.cells[row][col] === "cow") {
        return;
      }

      if (isCow(row, col)) {
        state.cells[row][col] = "cow";
        state.found += 1;
        paintCell(row, col);

        if (state.found === state.puzzle.n) {
          state.status = "won";
          syncHud("成功！全部小牛都找出来了。", "success");
        } else {
          syncHud("找到一只小牛。继续！");
        }
        return;
      }

      state.lives -= 1;
      flashWrong(row, col);

      if (state.lives <= 0) {
        state.status = "lost";
        syncHud("失败了。点击新局再试一次。", "error");
      } else {
        syncHud("这里没有小牛，扣 1 颗心。", "error");
      }
    }

    function flashWrong(row, col) {
      const cell = findCellElement(row, col);
      if (!cell) {
        return;
      }
      cell.classList.remove("is-wrong");
      void cell.offsetWidth;
      cell.classList.add("is-wrong");
      window.setTimeout(() => cell.classList.remove("is-wrong"), 420);
    }

    function finishTap(position) {
      const now = Date.now();
      const isDoubleTap =
        state.lastTap &&
        now - state.lastTap.time < 320 &&
        sameCell(position, state.lastTap.position);

      clearTimeout(state.tapTimer);

      if (isDoubleTap) {
        state.lastTap = null;
        confirmCow(position.row, position.col);
        return;
      }

      state.lastTap = { position, time: now };
      state.tapTimer = window.setTimeout(() => {
        if (state.lastTap && sameCell(position, state.lastTap.position)) {
          toggleCross(position.row, position.col);
          state.lastTap = null;
        }
      }, 260);
    }

    board.addEventListener("pointerdown", (event) => {
      const cell = getCellFromEvent(event);
      if (!cell || state.status !== "active") {
        return;
      }

      const position = readCell(cell);
      clearTimeout(state.tapTimer);
      state.pointer = {
        id: event.pointerId,
        start: position,
        last: position,
        moved: false,
        dragMode: state.cells[position.row][position.col] === "cross" ? "empty" : "cross",
      };
      board.setPointerCapture(event.pointerId);
    });

    board.addEventListener("pointermove", (event) => {
      if (!state.pointer || state.pointer.id !== event.pointerId || state.status !== "active") {
        return;
      }

      const cell = getCellFromPoint(event.clientX, event.clientY);
      if (!cell) {
        return;
      }

      const position = readCell(cell);
      if (!sameCell(position, state.pointer.start)) {
        state.pointer.moved = true;
      }

      if (state.pointer.moved && !sameCell(position, state.pointer.last)) {
        setCellState(position.row, position.col, state.pointer.dragMode);
        state.pointer.last = position;
      }
    });

    board.addEventListener("pointerup", (event) => {
      if (!state.pointer || state.pointer.id !== event.pointerId) {
        return;
      }

      const pointer = state.pointer;
      const cell = getCellFromPoint(event.clientX, event.clientY);
      const position = cell ? readCell(cell) : pointer.start;

      if (pointer.moved) {
        setCellState(pointer.start.row, pointer.start.col, pointer.dragMode);
        setCellState(position.row, position.col, pointer.dragMode);
        state.lastTap = null;
        clearTimeout(state.tapTimer);
      } else {
        finishTap(pointer.start);
      }

      state.pointer = null;
      if (board.hasPointerCapture(event.pointerId)) {
        board.releasePointerCapture(event.pointerId);
      }
    });

    board.addEventListener("pointercancel", (event) => {
      if (state.pointer && state.pointer.id === event.pointerId) {
        state.pointer = null;
      }
    });

    board.addEventListener("click", (event) => {
      event.preventDefault();
    });

    board.addEventListener("dblclick", (event) => {
      event.preventDefault();
    });

    newGameButton.addEventListener("click", startGame);

    window.CowSudokuGame = {
      newGame: startGame,
      getState: () => ({
        puzzle: state.puzzle,
        cells: state.cells.map((row) => row.slice()),
        lives: state.lives,
        found: state.found,
        status: state.status,
      }),
    };

    startGame();
  });
}

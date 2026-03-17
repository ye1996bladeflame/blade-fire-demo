import { setCursor, history, setClipboard, getClipboard, parseTransform, getMousePosition as getMousePositionCommon } from '../common/index.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function select(svg, onSelectionChangeCallback) {
  console.log('Select tool activated')
  setCursor(svg, 'default')

  let isActive = true

  // Selection state
  let selectedElements = []
  let transformGroup = null
  let selectionRect = null

  let isDragging = false
  let dragMode = null
  let startPos = { x: 0, y: 0 }
  let initialMouse = { x: 0, y: 0 }
  let lastMousePos = { x: 0, y: 0 }

  let elementStates = []
  let groupBounds = null
  let resizeHandle = null

  function notifySelectionChange() {
    if (onSelectionChangeCallback) {
      const selectionInfo = selectedElements.map(el => {
        const bounds = getElementGlobalBounds(el);
        return {
          id: el.id,
          tagName: el.tagName,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          rotation: (parseTransform(el.getAttribute('transform')).rotate || 0)
        };
      });
      onSelectionChangeCallback(selectionInfo);
    }
  }

  function rotatePoint(x, y, cx, cy, angle) {
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const dx = x - cx
    const dy = y - cy
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    }
  }

  function getMousePosition(evt) {
    return getMousePositionCommon(svg, evt)
  }

  function createSelectionRect(x, y) {
    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('x', x)
    rect.setAttribute('y', y)
    rect.setAttribute('width', 0)
    rect.setAttribute('height', 0)
    rect.setAttribute('fill', 'rgba(24, 144, 255, 0.1)')
    rect.setAttribute('stroke', '#1890ff')
    rect.setAttribute('stroke-width', 1)
    rect.setAttribute('stroke-dasharray', '4 2')
    svg.appendChild(rect)
    return rect
  }

  function getElementGlobalBounds(el) {
    try {
      const rect = el.getBoundingClientRect()
      const svgRect = svg.getBoundingClientRect()
      const ctm = svg.getScreenCTM().inverse()

      const p1 = new DOMPoint(rect.left, rect.top)
      const p2 = new DOMPoint(rect.right, rect.bottom)

      const start = p1.matrixTransform(ctm)
      const end = p2.matrixTransform(ctm)

      return {
        x: start.x,
        y: start.y,
        width: end.x - start.x,
        height: end.y - start.y,
      }
    } catch (e) {
      console.error('Failed to get element bounds:', e)
      return { x: 0, y: 0, width: 0, height: 0 }
    }
  }

  function getCursorForHandle(handleType, rotation) {
    if (!handleType || handleType === 'rotate') return 'grab'

    const angleMap = {
      n: 0,
      ne: 45,
      e: 90,
      se: 135,
      s: 180,
      sw: 225,
      w: 270,
      nw: 315,
    }

    let angle = angleMap[handleType]
    if (angle === undefined) return 'default'

    angle = (angle + rotation) % 360
    if (angle < 0) angle += 360

    const snapped = (Math.round(angle / 45) * 45) % 360

    const cursorMap = {
      0: 'n-resize',
      45: 'ne-resize',
      90: 'e-resize',
      135: 'se-resize',
      180: 's-resize',
      225: 'sw-resize',
      270: 'w-resize',
      315: 'nw-resize',
    }

    return cursorMap[snapped] || 'default'
  }

  function parsePathData(d) {
    if (!d) return []
    const points = []

    const commands = d.match(/[MmLlHhVv][^MmLlHhVv]*/g) || []
    let currentPos = { x: 0, y: 0 }
    commands.forEach((cmdStr) => {
      const type = cmdStr[0]
      const args = cmdStr
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter((n) => !isNaN(n))

      if (type === 'M' || type === 'L') {
        for (let i = 0; i < args.length; i += 2) {
          currentPos = { x: args[i], y: args[i + 1] }
          points.push(currentPos)
        }
      } else if (type === 'm' || type === 'l') {
        for (let i = 0; i < args.length; i += 2) {
          currentPos.x += args[i]
          currentPos.y += args[i + 1]
          points.push({ ...currentPos })
        }
      }
    })

    const finalPoints = []
    const uniquePoints = new Set()
    for (const p of points) {
      const key = `${p.x},${p.y}`
      if (!uniquePoints.has(key)) {
        uniquePoints.add(key)
        finalPoints.push(p)
      }
    }

    if (finalPoints.length > 2) {
      const first = finalPoints[0]
      const last = finalPoints[finalPoints.length - 1]
      if (first.x === last.x && first.y === last.y) {
        finalPoints.pop()
      }
    }

    return finalPoints
  }

  function buildPathData(points) {
    if (!points || points.length === 0) return ''
    const d = points
      .map((p, i) => {
        return (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`
      })
      .join(' ')
    return d + ' Z'
  }

  function createVertexHandles(polygon) {
    if (transformGroup) {
      if (transformGroup.parentNode) transformGroup.parentNode.removeChild(transformGroup)
      transformGroup = null
    }

    transformGroup = document.createElementNS(SVG_NS, 'g')
    const transform = polygon.getAttribute('transform')
    if (transform) {
      transformGroup.setAttribute('transform', transform)
    }

    const d = polygon.getAttribute('d')
    const points = parsePathData(d)

    const handleSize = 8
    points.forEach((p, index) => {
      const handle = document.createElementNS(SVG_NS, 'circle')
      handle.setAttribute('cx', p.x)
      handle.setAttribute('cy', p.y)
      handle.setAttribute('r', handleSize / 2)
      handle.setAttribute('fill', 'white')
      handle.setAttribute('stroke', '#1890ff')
      handle.setAttribute('stroke-width', 1)
      handle.style.cursor = 'move'
      handle.dataset.type = 'vertex'
      handle.dataset.index = index
      transformGroup.appendChild(handle)
    })

    svg.appendChild(transformGroup)
  }

  function updateTransformHandles() {
    if (!isActive) return

    if (transformGroup) {
      if (transformGroup.parentNode) transformGroup.parentNode.removeChild(transformGroup)
      transformGroup = null
    }

    if (selectedElements.length === 0) {
      notifySelectionChange()
      return
    }

    transformGroup = document.createElementNS(SVG_NS, 'g')

    let bbox
    let rotation = 0

    if (selectedElements.length === 1) {
      const el = selectedElements[0]
      try {
        bbox = el.getBBox()
        const transform = el.getAttribute('transform')
        if (transform) {
          transformGroup.setAttribute('transform', transform)
          const tData = parseTransform(transform)
          rotation = tData.rotate
        }
      } catch (e) {
        bbox = { x: 0, y: 0, width: 0, height: 0 }
      }
    } else {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      selectedElements.forEach((el) => {
        const b = getElementGlobalBounds(el)
        minX = Math.min(minX, b.x)
        minY = Math.min(minY, b.y)
        maxX = Math.max(maxX, b.x + b.width)
        maxY = Math.max(maxY, b.y + b.height)
      })
      bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }

    const frame = document.createElementNS(SVG_NS, 'rect')
    frame.setAttribute('x', bbox.x)
    frame.setAttribute('y', bbox.y)
    frame.setAttribute('width', bbox.width)
    frame.setAttribute('height', bbox.height)
    frame.setAttribute('fill', 'none')
    frame.setAttribute('stroke', '#1890ff')
    frame.setAttribute('stroke-width', 1)
    frame.setAttribute('class', 'selection-frame')
    transformGroup.appendChild(frame)

    const handleSize = 8
    const positions = [
      { x: bbox.x, y: bbox.y, type: 'nw' },
      { x: bbox.x + bbox.width, y: bbox.y, type: 'ne' },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height, type: 'se' },
      { x: bbox.x, y: bbox.y + bbox.height, type: 'sw' },

      { x: bbox.x + bbox.width / 2, y: bbox.y, type: 'n' },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2, type: 'e' },
      { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height, type: 's' },
      { x: bbox.x, y: bbox.y + bbox.height / 2, type: 'w' },
    ]

    positions.forEach((pos) => {
      const handle = document.createElementNS(SVG_NS, 'rect')
      handle.setAttribute('x', pos.x - handleSize / 2)
      handle.setAttribute('y', pos.y - handleSize / 2)
      handle.setAttribute('width', handleSize)
      handle.setAttribute('height', handleSize)
      handle.setAttribute('fill', 'white')
      handle.setAttribute('stroke', '#1890ff')
      handle.setAttribute('stroke-width', 1)

      const cursor = getCursorForHandle(pos.type, rotation)
      handle.style.cursor = cursor
      handle.dataset.type = pos.type
      transformGroup.appendChild(handle)
    })

    const rotHandle = document.createElementNS(SVG_NS, 'circle')
    const rotX = bbox.x + bbox.width / 2
    const rotY = bbox.y - 20
    rotHandle.setAttribute('cx', rotX)
    rotHandle.setAttribute('cy', rotY)
    rotHandle.setAttribute('r', 5)
    rotHandle.setAttribute('fill', 'white')
    rotHandle.setAttribute('stroke', '#1890ff')
    rotHandle.style.cursor = 'grab'
    rotHandle.dataset.type = 'rotate'
    transformGroup.appendChild(rotHandle)

    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', rotX)
    line.setAttribute('y1', rotY + 5)
    line.setAttribute('x2', rotX)
    line.setAttribute('y2', bbox.y)
    line.setAttribute('stroke', '#1890ff')
    transformGroup.insertBefore(line, rotHandle)

    svg.appendChild(transformGroup)
    notifySelectionChange()
  }

  function clearSelection() {
    selectedElements = []
    updateTransformHandles()
    notifySelectionChange()
  }

  function captureState(pos) {
    initialMouse = pos

    if (selectedElements.length === 1) {
      const el = selectedElements[0]
      const transform = el.getAttribute('transform') || ''
      const tData = parseTransform(transform)

      if (dragMode === 'vertex') {
        elementStates = [
          {
            el,
            initPoints: parsePathData(el.getAttribute('d')),
            initTransform: transform,
            tData: tData,
          },
        ]
        return
      }

      let initW = 0,
        initH = 0,
        initX = 0,
        initY = 0
      const bbox = el.getBBox()

      if (el.tagName === 'rect' || el.tagName === 'image') {
        initW = parseFloat(el.getAttribute('width'))
        initH = parseFloat(el.getAttribute('height'))
        initX = parseFloat(el.getAttribute('x'))
        initY = parseFloat(el.getAttribute('y'))
      } else {
        initW = bbox.width * tData.sx
        initH = bbox.height * tData.sy
        initX = bbox.x
        initY = bbox.y
      }

      elementStates = [
        {
          el,
          initTx: tData.tx,
          initTy: tData.ty,
          initRot: tData.rotate,
          initCx: tData.cx,
          initCy: tData.cy,
          initSx: tData.sx,
          initSy: tData.sy,
          bbox: bbox,
          initWidth: initW,
          initHeight: initH,
          initX: initX,
          initY: initY,
          initTransform: transform,
          tagName: el.tagName,
        },
      ]
    } else {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      elementStates = selectedElements.map((el) => {
        const b = getElementGlobalBounds(el)
        minX = Math.min(minX, b.x)
        minY = Math.min(minY, b.y)
        maxX = Math.max(maxX, b.x + b.width)
        maxY = Math.max(maxY, b.y + b.height)
        return {
          el,
          initTransform: el.getAttribute('transform') || '',
        }
      })

      groupBounds = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        cx: minX + (maxX - minX) / 2,
        cy: minY + (maxY - minY) / 2,
      }
    }
  }

  function onMouseDown(evt) {
    if (evt.button !== 0) return
    const pos = getMousePosition(evt)
    lastMousePos = pos
    startPos = pos
    isDragging = true
    const target = evt.target

    if (target.closest('foreignObject')) {
      return
    }

    if (target.parentNode === transformGroup && target.dataset.type) {
      if (target.dataset.type === 'vertex') {
        dragMode = 'vertex'
        resizeHandle = target.dataset.index
      } else {
        dragMode = target.dataset.type === 'rotate' ? 'rotate' : 'resize'
        resizeHandle = target.dataset.type
      }
      setCursor(svg, target.style.cursor)
      captureState(pos)
      evt.stopPropagation()
      return
    }

    const isSelected = selectedElements.includes(target)
    const isFrame = target.parentNode === transformGroup && target.classList.contains('selection-frame')

    if (isSelected || isFrame) {
      if ((evt.shiftKey || evt.ctrlKey) && isSelected) {
        selectedElements = selectedElements.filter((el) => el !== target)
        updateTransformHandles()
        isDragging = false
        return
      }
      dragMode = 'move'
      captureState(pos)
      evt.stopPropagation()
      return
    }

    if (!evt.shiftKey && !evt.ctrlKey) {
      clearSelection()
    }

    if (target !== svg && target.tagName !== 'defs' && target.getAttribute('data-is-grid') !== 'true' && !target.classList.contains('grid-rect')) {
      if (!selectedElements.includes(target)) {
        selectedElements.push(target)
        updateTransformHandles()
        dragMode = 'move'
        captureState(pos)
        evt.stopPropagation()
        return
      }
    }

    dragMode = 'select'
    selectionRect = createSelectionRect(pos.x, pos.y)
  }

  function onMouseMove(evt) {
    const pos = getMousePosition(evt)
    lastMousePos = pos
    if (!isDragging) return
    const dx = pos.x - initialMouse.x
    const dy = pos.y - initialMouse.y

    if (dragMode === 'select') {
      const x = Math.min(startPos.x, pos.x)
      const y = Math.min(startPos.y, pos.y)
      const w = Math.abs(pos.x - startPos.x)
      const h = Math.abs(pos.y - startPos.y)
      selectionRect.setAttribute('x', x)
      selectionRect.setAttribute('y', y)
      selectionRect.setAttribute('width', w)
      selectionRect.setAttribute('height', h)
    } else if (dragMode === 'vertex') {
      const s = elementStates[0]
      const index = parseInt(resizeHandle, 10)

      let ldx = dx
      let ldy = dy
      const t = s.tData
      if (t.rotate) {
        const rad = (-t.rotate * Math.PI) / 180
        ldx = dx * Math.cos(rad) - dy * Math.sin(rad)
        ldy = dx * Math.sin(rad) + dy * Math.cos(rad)
      }

      ldx /= t.sx
      ldy /= t.sy

      const newPoints = s.initPoints.map((p, i) => {
        if (i === index) {
          return { x: p.x + ldx, y: p.y + ldy }
        }
        return p
      })

      const newD = buildPathData(newPoints)
      s.el.setAttribute('d', newD)

      const handle = transformGroup.querySelector(`[data-index="${index}"]`)
      if (handle) {
        handle.setAttribute('cx', newPoints[index].x)
        handle.setAttribute('cy', newPoints[index].y)
      }
    } else if (dragMode === 'move') {
      setCursor(svg, 'move')
      if (selectedElements.length === 1) {
        const s = elementStates[0]
        const newTx = s.initTx + dx
        const newTy = s.initTy + dy

        let tStr = `translate(${newTx}, ${newTy})`
        if (s.initRot) {
          tStr += ` rotate(${s.initRot}, ${s.initCx || 0}, ${s.initCy || 0})`
        }

        if (s.initSx !== 1 || s.initSy !== 1) {
          tStr += ` scale(${s.initSx}, ${s.initSy})`
        }

        s.el.setAttribute('transform', tStr)
        transformGroup.setAttribute('transform', tStr)
      } else {
        selectedElements.forEach((el, i) => {
          const s = elementStates[i]
          el.setAttribute('transform', `translate(${dx}, ${dy}) ${s.initTransform}`)
        })
        transformGroup.setAttribute('transform', `translate(${dx}, ${dy})`)
      }
    } else if (dragMode === 'rotate') {
      if (selectedElements.length === 1) {
        const s = elementStates[0]
        const cx = s.initCx || s.bbox.x + s.bbox.width / 2
        const cy = s.initCy || s.bbox.y + s.bbox.height / 2

        const centerX = cx * s.initSx + s.initTx
        const centerY = cy * s.initSy + s.initTy

        const visualCx = (s.bbox.x + s.bbox.width / 2) * s.initSx + s.initTx
        const visualCy = (s.bbox.y + s.bbox.height / 2) * s.initSy + s.initTy

        const angle = (Math.atan2(pos.y - visualCy, pos.x - visualCx) * 180) / Math.PI + 90

        let tStr = `translate(${s.initTx}, ${s.initTy}) rotate(${angle}, ${(s.bbox.x + s.bbox.width / 2) * s.initSx}, ${(s.bbox.y + s.bbox.height / 2) * s.initSy})`
        if (s.initSx !== 1 || s.initSy !== 1) {
          tStr += ` scale(${s.initSx}, ${s.initSy})`
        }

        s.el.setAttribute('transform', tStr)
        transformGroup.setAttribute('transform', tStr)
      } else {
        const cx = groupBounds.cx
        const cy = groupBounds.cy
        const angle = (Math.atan2(pos.y - cy, pos.x - cx) * 180) / Math.PI + 90

        selectedElements.forEach((el, i) => {
          const s = elementStates[i]
          el.setAttribute('transform', `rotate(${angle}, ${cx}, ${cy}) ${s.initTransform}`)
        })
        transformGroup.setAttribute('transform', `rotate(${angle}, ${cx}, ${cy})`)
      }
    } else if (dragMode === 'resize') {
      if (selectedElements.length === 1) {
        const s = elementStates[0]

        let ldx = dx
        let ldy = dy
        if (s.initRot) {
          const rad = (s.initRot * Math.PI) / 180
          const cos = Math.cos(-rad)
          const sin = Math.sin(-rad)
          ldx = dx * cos - dy * sin
          ldy = dx * sin + dy * cos
        }

        if (s.tagName === 'rect' || s.tagName === 'image') {
          let anchorX = s.initX
          let anchorY = s.initY

          if (resizeHandle.includes('w')) anchorX = s.initX + s.initWidth
          if (resizeHandle.includes('n')) anchorY = s.initY + s.initHeight

          const globalAnchor = rotatePoint(anchorX, anchorY, s.initCx || s.bbox.x + s.bbox.width / 2, s.initCy || s.bbox.y + s.bbox.height / 2, s.initRot)
          globalAnchor.x += s.initTx
          globalAnchor.y += s.initTy

          let newW = s.initWidth
          let newH = s.initHeight
          let newX = s.initX
          let newY = s.initY

          if (resizeHandle.includes('e')) newW += ldx
          if (resizeHandle.includes('s')) newH += ldy
          if (resizeHandle.includes('w')) {
            newW -= ldx
            newX += ldx
          }
          if (resizeHandle.includes('n')) {
            newH -= ldy
            newY += ldy
          }

          if (newW < 1) newW = 1
          if (newH < 1) newH = 1

          const newCX = newX + newW / 2
          const newCY = newY + newH / 2

          const rotatedAnchor = rotatePoint(anchorX, anchorY, newCX, newCY, s.initRot)

          const newTx = globalAnchor.x - rotatedAnchor.x
          const newTy = globalAnchor.y - rotatedAnchor.y

          s.el.setAttribute('x', newX)
          s.el.setAttribute('y', newY)
          s.el.setAttribute('width', newW)
          s.el.setAttribute('height', newH)

          const tStr = `translate(${newTx}, ${newTy}) rotate(${s.initRot}, ${newCX}, ${newCY})`
          s.el.setAttribute('transform', tStr)
          transformGroup.setAttribute('transform', tStr)

          updateTransformHandles()
        } else {
          let newVisualW = s.initWidth
          let newVisualH = s.initHeight

          if (resizeHandle.includes('e')) newVisualW += ldx
          if (resizeHandle.includes('s')) newVisualH += ldy
          if (resizeHandle.includes('w')) newVisualW -= ldx
          if (resizeHandle.includes('n')) newVisualH -= ldy

          if (newVisualW < 1) newVisualW = 1
          if (newVisualH < 1) newVisualH = 1

          const sx = newVisualW / s.bbox.width
          const sy = newVisualH / s.bbox.height

          let anchorLocalX_scaled = s.initX * s.initSx
          let anchorLocalY_scaled = s.initY * s.initSy

          if (resizeHandle.includes('w')) anchorLocalX_scaled = (s.initX + s.bbox.width) * s.initSx
          if (resizeHandle.includes('n')) anchorLocalY_scaled = (s.initY + s.bbox.height) * s.initSy

          const oldVisualCx = (s.bbox.x + s.bbox.width / 2) * s.initSx
          const oldVisualCy = (s.bbox.y + s.bbox.height / 2) * s.initSy

          const globalAnchor = rotatePoint(anchorLocalX_scaled, anchorLocalY_scaled, oldVisualCx, oldVisualCy, s.initRot)
          globalAnchor.x += s.initTx
          globalAnchor.y += s.initTy

          let newAnchorX_scaled = s.initX * sx
          let newAnchorY_scaled = s.initY * sy

          if (resizeHandle.includes('w')) newAnchorX_scaled = (s.initX + s.bbox.width) * sx
          if (resizeHandle.includes('n')) newAnchorY_scaled = (s.initY + s.bbox.height) * sy

          const newVisualCx = (s.bbox.x + s.bbox.width / 2) * sx
          const newVisualCy = (s.bbox.y + s.bbox.height / 2) * sy

          const rotatedNewAnchor = rotatePoint(newAnchorX_scaled, newAnchorY_scaled, newVisualCx, newVisualCy, s.initRot)

          const newTx = globalAnchor.x - rotatedNewAnchor.x
          const newTy = globalAnchor.y - rotatedNewAnchor.y

          const tStr = `translate(${newTx}, ${newTy}) rotate(${s.initRot}, ${newVisualCx}, ${newVisualCy}) scale(${sx}, ${sy})`

          s.el.setAttribute('transform', tStr)

          transformGroup.setAttribute('transform', tStr)
          updateTransformHandles()
        }
      } else {
        const currentW = groupBounds.width
        const currentH = groupBounds.height

        let newX = groupBounds.x
        let newY = groupBounds.y
        let newW = currentW
        let newH = currentH

        if (resizeHandle.includes('e')) newW += dx
        if (resizeHandle.includes('s')) newH += dy
        if (resizeHandle.includes('w')) {
          newW -= dx
          newX += dx
        }
        if (resizeHandle.includes('n')) {
          newH -= dy
          newY += dy
        }

        if (newW < 1) newW = 1
        if (newH < 1) newH = 1

        const sx = newW / currentW
        const sy = newH / currentH

        const tx = newX - groupBounds.x * sx
        const ty = newY - groupBounds.y * sy

        selectedElements.forEach((el, i) => {
          const s = elementStates[i]
          el.setAttribute('transform', `translate(${tx}, ${ty}) scale(${sx}, ${sy}) ${s.initTransform}`)
        })

        transformGroup.setAttribute('transform', `translate(${tx}, ${ty}) scale(${sx}, ${sy})`)
      }
    }

    if (dragMode === 'move' || dragMode === 'resize' || dragMode === 'rotate' || dragMode === 'vertex') {
        notifySelectionChange();
    }
  }

  function onMouseUp(evt) {
    if (!isDragging) return

    if (dragMode === 'move' || dragMode === 'resize' || dragMode === 'rotate' || dragMode === 'vertex') {
      const changes = []

      elementStates.forEach((s) => {
        const el = s.el
        const currentTransform = el.getAttribute('transform') || ''
        const oldTransform = s.initTransform || ''

        let changed = false
        const change = { el, oldTransform, newTransform: currentTransform }

        if (currentTransform !== oldTransform) changed = true

        if (dragMode === 'vertex') {
          const currentD = el.getAttribute('d')

          const oldD = buildPathData(s.initPoints)

          if (currentD !== oldD) {
            changed = true
            change.oldD = oldD
            change.newD = currentD
            change.isVertex = true
          }
        } else if (dragMode === 'resize' && (el.tagName === 'rect' || el.tagName === 'image')) {
          const currentX = parseFloat(el.getAttribute('x') || 0)
          const currentY = parseFloat(el.getAttribute('y') || 0)
          const currentW = parseFloat(el.getAttribute('width') || 0)
          const currentH = parseFloat(el.getAttribute('height') || 0)

          if (currentX !== s.initX || currentY !== s.initY || currentW !== s.initWidth || currentH !== s.initHeight) {
            changed = true
            change.oldX = s.initX
            change.newX = currentX
            change.oldY = s.initY
            change.newY = currentY
            change.oldW = s.initWidth
            change.newW = currentW
            change.oldH = s.initHeight
            change.newH = currentH
            change.isRect = true
          }
        }

        if (changed) {
          changes.push(change)
        }
      })

      if (changes.length > 0) {
        history.push({
          desc: '变换元素',
          undo: () => {
            changes.forEach((c) => {
              if (c.oldTransform) c.el.setAttribute('transform', c.oldTransform)
              else c.el.removeAttribute('transform')

              if (c.isVertex) {
                c.el.setAttribute('d', c.oldD)
              } else if (c.isRect) {
                c.el.setAttribute('x', c.oldX)
                c.el.setAttribute('y', c.oldY)
                c.el.setAttribute('width', c.oldW)
                c.el.setAttribute('height', c.oldH)
              }
            })
          },
          redo: () => {
            changes.forEach((c) => {
              if (c.newTransform) c.el.setAttribute('transform', c.newTransform)
              else c.el.removeAttribute('transform')

              if (c.isVertex) {
                c.el.setAttribute('d', c.newD)
              } else if (c.isRect) {
                c.el.setAttribute('x', c.newX)
                c.el.setAttribute('y', c.newY)
                c.el.setAttribute('width', c.newW)
                c.el.setAttribute('height', c.newH)
              }
            })
          },
        })
      }
    }

    isDragging = false
    setCursor(svg, 'default')

    if (dragMode === 'select') {
      const r1 = {
        x: parseFloat(selectionRect.getAttribute('x')),
        y: parseFloat(selectionRect.getAttribute('y')),
        w: parseFloat(selectionRect.getAttribute('width')),
        h: parseFloat(selectionRect.getAttribute('height')),
      }

      svg.removeChild(selectionRect)
      selectionRect = null

      const children = Array.from(svg.children)
      for (let el of children) {
        if (el.tagName === 'defs' || el.tagName === 'g' || el.tagName === 'foreignObject' || el.id === 'grid-background' || el.getAttribute('data-is-grid') === 'true') continue

        try {
          const bbox = getElementGlobalBounds(el)

          if (r1.x < bbox.x + bbox.width && r1.x + r1.w > bbox.x && r1.y < bbox.y + bbox.height && r1.y + r1.h > bbox.y) {
            if (!selectedElements.includes(el)) {
              selectedElements.push(el)
            }
          }
        } catch (e) {}
      }
    }

    updateTransformHandles()
    dragMode = null
  }

  const observer = new MutationObserver((mutations) => {
    let needsUpdate = false
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.removedNodes.forEach((node) => {
          const index = selectedElements.indexOf(node)
          if (index > -1) {
            selectedElements.splice(index, 1)
            needsUpdate = true
          }
        })
      } else if (mutation.type === 'attributes') {
        if (selectedElements.includes(mutation.target) && !isDragging) {
          needsUpdate = true
        }
      }
    })
    if (needsUpdate) {
      updateTransformHandles()
    }
  })

  observer.observe(svg, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['transform', 'd', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry'],
  })

  function onKeyDown(evt) {
    if (evt.target.tagName === 'INPUT' || evt.target.tagName === 'TEXTAREA') return

    // Delete elements
    if (evt.key === 'Delete' || evt.key === 'Backspace') {
      if (selectedElements.length === 0) return

      const elementsToRemove = [...selectedElements]
      // Record the state before removing
      const parentsInfo = elementsToRemove.map((el) => {
        return {
          parent: el.parentNode || svg,
          nextSibling: el.nextSibling,
        }
      })

      // Remove from DOM
      elementsToRemove.forEach((el) => {
        if (el.parentNode) {
          el.parentNode.removeChild(el)
        }
      })

      history.push({
        desc: '删除元素',
        undo: () => {
          elementsToRemove.forEach((el, i) => {
            const info = parentsInfo[i]
            try {
              if (info.parent) {
                // If nextSibling is still valid and in the same parent
                if (info.nextSibling && info.nextSibling.parentNode === info.parent) {
                  info.parent.insertBefore(el, info.nextSibling)
                } else {
                  // Fallback to appendChild on parent
                  info.parent.appendChild(el)
                }
              } else {
                // Ultimate fallback
                svg.appendChild(el)
              }
            } catch (err) {
              console.error("Failed to restore element during undo", err)
              svg.appendChild(el)
            }
          })
        },
        redo: () => {
          elementsToRemove.forEach((el) => {
            if (el.parentNode) {
              el.parentNode.removeChild(el)
            }
          })
        },
      })

      selectedElements = []
      updateTransformHandles()
      evt.preventDefault()
      return
    }

    // Copy: Ctrl+C
    if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'c') {
      if (selectedElements.length === 0) return

      // Calculate bounds center of current selection
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      selectedElements.forEach((el) => {
        const b = getElementGlobalBounds(el)
        minX = Math.min(minX, b.x)
        minY = Math.min(minY, b.y)
        maxX = Math.max(maxX, b.x + b.width)
        maxY = Math.max(maxY, b.y + b.height)
      })

      const centerX = minX + (maxX - minX) / 2
      const centerY = minY + (maxY - minY) / 2

      setClipboard({
        elements: selectedElements.map((el) => {
          const attrs = {}
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i]
            attrs[attr.name] = attr.value
          }
          return {
            tagName: el.tagName,
            attributes: attrs,
            innerHTML: el.innerHTML,
          }
        }),
        centerX,
        centerY,
      })
      evt.preventDefault()
    }

    // Paste: Ctrl+V logic removed from here as it is now handled globally
  }

  svg.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)

  return () => {
    isActive = false
    console.log('Select tool deactivated')
    observer.disconnect()
    svg.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown)
    if (transformGroup && transformGroup.parentNode) transformGroup.parentNode.removeChild(transformGroup)
    if (selectionRect && selectionRect.parentNode) selectionRect.parentNode.removeChild(selectionRect)
  }
}

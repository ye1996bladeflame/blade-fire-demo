<template>
  <a-layout class="layout-container">
    <a-layout-sider theme="light" width="200" class="left-sider">
      <div class="toolbar">
        <div class="toolbar-title">页面管理</div>
        <div style="display: flex; gap: 8px; margin-bottom: 16px; align-items: center">
          <a-select v-model:value="currentPageId" style="flex: 1" @change="switchPage">
            <a-select-option v-for="page in pages" :key="page.id" :value="page.id">
              {{ page.name }}
            </a-select-option>
          </a-select>
          <a-button type="primary" @click="addPage"> 新增 </a-button>
        </div>

        <div class="toolbar-title">绘制工具</div>
        <div class="tools-grid">
          <a-tooltip v-for="tool in tools" :key="tool.key" :title="tool.title" placement="right">
            <div class="tool-icon-btn" :class="{ active: currentTool === tool.key }" @click="selectTool(tool.key)">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="tool.icon"></svg>
            </div>
          </a-tooltip>
        </div>

        <div class="toolbar-title" style="margin-top: 20px">辅助工具</div>
        <div class="tools-grid">
          <a-tooltip title="多边形橡皮擦 (Eraser)" placement="right">
            <div class="tool-icon-btn" :class="{ active: currentTool === 'erase' }" @click="selectTool('erase')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13l-5 5L3 8l5-5 10 10z"></path>
                <path d="M13 18l5 5"></path>
              </svg>
            </div>
          </a-tooltip>
        </div>
      </div>
    </a-layout-sider>
    <a-layout-content class="content-area">
      <div id="map-container"></div>
    </a-layout-content>

    <a-layout-sider theme="light" width="300" class="right-sider">
      <div class="right-panel-content">
        <a-card title="属性" size="small" :bordered="false" class="panel-card" :bodyStyle="{ flex: 1, overflowY: 'auto', minHeight: 0 }">
          <a-empty v-if="selectionInfo.length === 0" description="未选中任何图形" :image="undefined" />
          <div v-else>
            <a-descriptions v-for="(item, idx) in selectionInfo" :key="idx" :title="item.tagName" size="small" :column="1" bordered style="margin-bottom: 16px">
              <a-descriptions-item label="X">{{ Math.round(item.x) }}</a-descriptions-item>
              <a-descriptions-item label="Y">{{ Math.round(item.y) }}</a-descriptions-item>
              <a-descriptions-item label="宽度">{{ Math.round(item.width) }}</a-descriptions-item>
              <a-descriptions-item label="高度">{{ Math.round(item.height) }}</a-descriptions-item>
              <a-descriptions-item label="旋转">{{ ((Math.round(item.rotation || 0) % 360) + 360) % 360 }}°</a-descriptions-item>
            </a-descriptions>
          </div>
        </a-card>

        <a-divider style="margin: 0" />

        <a-card title="历史消息" size="small" :bordered="false" class="panel-card" :bodyStyle="{ flex: 1, overflowY: 'auto', minHeight: 0 }">
          <a-empty v-if="historyLog.length === 0" description="暂无历史记录" :image="undefined" />
          <div v-else class="history-list">
            <a-card v-for="(item, index) in historyLog" :key="index" size="small" class="history-item-card" :bordered="false" :bodyStyle="{ padding: '8px 12px' }">
              <div class="history-content">
                <span class="history-index">#{{ index + 1 }}</span>
                <span class="history-desc">{{ item.desc || '未知操作' }}</span>
              </div>
            </a-card>
          </div>
        </a-card>
      </div>
    </a-layout-sider>
  </a-layout>
</template>

<script setup>
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { BladeFire } from '../blade-fire/index.js'

// Page Management
const pages = ref([{ id: 'page-1', name: '画板 1' }])
const currentPageId = ref('page-1')
let pageCounter = 1

const currentTool = ref('')

// 绘制工具配置：key 需与 BladeFire 静态方法名一致
const tools = [
  { key: 'select', title: '选择 (Select)', icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path>' },
  { key: 'circle', title: '圆形 (Circle)', icon: '<circle cx="12" cy="12" r="10"></circle>' },
  { key: 'rect', title: '矩形 (Rect)', icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>' },
  { key: 'rotateRect', title: '旋转矩形 (Rotate Rect)', icon: '<rect x="6" y="6" width="12" height="12" rx="1" transform="rotate(20 12 12)"></rect>' },
  { key: 'path-rect', title: '路径矩形 (Path Rect)', icon: '<rect x="3" y="3" width="18" height="18" rx="1"></rect><circle cx="7" cy="17" r="2" fill="currentColor" stroke="none"></circle>' },
  { key: 'triangle', title: '三角形 (Triangle)', icon: '<path d="M12 3l10 18H2L12 3z"></path>' },
  { key: 'polygon', title: '多边形 (Polygon)', icon: '<path d="M12 2l9 4.9V17L12 22l-9-4.9V7z"></path>' },
  { key: 'freehand', title: '手绘 (Freehand)', icon: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>' },
  { key: 'pathEllipse', title: '路径椭圆 (Path Ellipse)', icon: '<ellipse cx="12" cy="12" rx="9" ry="6"></ellipse>' }
]

const selectionInfo = ref([])
const historyLog = ref([])
let activeToolCleanup = null
let selectionCleanup = null
let historyCleanup = null
let undoRedoCleanup = null
let bladeFireCleanup = null
let bladeFireInstance = null

const initCanvas = () => {
  if (bladeFireInstance && bladeFireInstance.destroy) {
    bladeFireInstance.destroy()
  }

  // Clear container
  const container = document.getElementById('map-container')
  if (container) {
    container.innerHTML = ''
  }

  BladeFire.clearHistory()
  historyLog.value = []
  selectionInfo.value = []

  bladeFireInstance = BladeFire.init({ container: 'map-container', grid: true, gridSize: 40, zoom: true,ruler:true })
  if (bladeFireInstance && bladeFireInstance.destroy) {
    bladeFireCleanup = bladeFireInstance.destroy
  }

  if (selectionCleanup) selectionCleanup()
  selectionCleanup = BladeFire.onSelectionChange((info) => {
    selectionInfo.value = info
  })

  if (historyCleanup) historyCleanup()
  historyCleanup = BladeFire.onHistoryChange((stack) => {
    historyLog.value = [...stack]
  })

  if (undoRedoCleanup) undoRedoCleanup()
  undoRedoCleanup = BladeFire.onUndoRedoRestore((shapeType, tagName) => {
  })

  // Restore current tool if any
  if (currentTool.value) {
    const tool = currentTool.value
    currentTool.value = ''
    selectTool(tool)
  }

  BladeFire.createShape('image', {
    href: 'https://gips2.baidu.com/it/u=195724436,3554684702&fm=3028&app=3028&f=JPEG&fmt=auto?w=1280&h=960',
    'draw-area': true
  })
  BladeFire.createShape('rect', {
    x: 120,
    y: 120,
    width: 300,
    height: 300,
    fill: 'rgba(255, 0, 0, 0.5)',
    stroke: 'red',
    'stroke-width': '1',
    uid:'666666'
  })
  // BladeFire.createShape('circle', {
  //   cx: 240,
  //   cy: 240,
  //   r: 100,
  //   fill: 'rgba(0, 255, 0, 0.5)',
  //   stroke: 'green',
  //   'stroke-width': '1',
  //   uid:'777777'
  // })
  // BladeFire.createShape('path', {
  //   d: 'M 120 120 L 240 240 L 11 240 L 44 120 L Z',
  //   fill: '#00ff0080',
  //   stroke: '#00ff0080',
  //   'stroke-width': '1',
  //   uid:'888888'
  // })
}

const addPage = () => {
  pageCounter++
  const newPage = { id: `page-${pageCounter}`, name: `画板 ${pageCounter}` }
  pages.value.push(newPage)
  currentPageId.value = newPage.id
  switchPage(newPage.id)
}

const switchPage = (pageId) => {
  currentPageId.value = pageId
  // For a real implementation, you'd save the SVG state of the old page and load the new one.
  // Here we just re-initialize a blank canvas for the new page.
  nextTick(() => {
    initCanvas()
  })
}

const selectTool = (tool) => {
  // If clicking the same tool, do nothing or toggle?
  // For now, let's assume re-selecting resets the tool.

  // Cleanup previous tool
  if (activeToolCleanup) {
    activeToolCleanup()
    activeToolCleanup = null
  }

  currentTool.value = tool
  if (BladeFire[tool]) {
    const cleanup = BladeFire[tool]()
    if (typeof cleanup === 'function') {
      activeToolCleanup = cleanup
    }
  }
}

onMounted(() => {
  initCanvas()
})

onUnmounted(() => {
  if (selectionCleanup) selectionCleanup()
  if (historyCleanup) historyCleanup()
  if (undoRedoCleanup) undoRedoCleanup()
  if (bladeFireCleanup) bladeFireCleanup()
})
</script>

<style scoped>
.layout-container {
  width: 100vw;
  height: 100vh;
  display: flex;
}

.left-sider {
  border-right: 1px solid #f0f0f0;
  z-index: 10;
}

.right-sider {
  border-left: 1px solid #f0f0f0;
  z-index: 10;
}

.content-area {
  position: relative;
  overflow: hidden;
  flex: 1;
}

#map-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.toolbar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.tool-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  border-radius: 4px;
  cursor: pointer;
  background-color: #f5f5f5;
  color: #666;
  transition: all 0.2s;
}

.tool-icon-btn:hover {
  background-color: #e6f7ff;
  color: #1890ff;
}

.tool-icon-btn.active {
  background-color: #1890ff;
  color: white;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.2);
}

.right-panel-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #fff;
}

.panel-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
}

.history-item-card {
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.3s;
}

.history-item-card:hover {
  background: #e6f7ff;
}

.history-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-index {
  color: #999;
  font-family: monospace;
  min-width: 24px;
}

.history-desc {
  font-weight: 500;
  color: #333;
}
</style>

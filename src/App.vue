<template>
  <a-layout class="layout-container">
    <a-layout-sider theme="light" width="200" class="left-sider">
      <div class="toolbar">
        <div class="toolbar-title">绘制工具</div>
        <div class="tools-grid">
          <a-tooltip title="选择 (Select)" placement="right">
            <div class="tool-icon-btn" :class="{ active: currentTool === 'select' }" @click="selectTool('select')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
                <path d="M13 13l6 6"></path>
              </svg>
            </div>
          </a-tooltip>
          
          <a-tooltip title="圆形 (Circle)" placement="right">
            <div class="tool-icon-btn" :class="{ active: currentTool === 'circle' }" @click="selectTool('circle')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
            </div>
          </a-tooltip>
          
          <a-tooltip title="矩形 (Rect)" placement="right">
            <div class="tool-icon-btn" :class="{ active: currentTool === 'rect' }" @click="selectTool('rect')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </div>
          </a-tooltip>
          
          <a-tooltip title="三角形 (Triangle)" placement="right">
            <div class="tool-icon-btn" :class="{ active: currentTool === 'triangle' }" @click="selectTool('triangle')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l10 18H2L12 3z"></path>
              </svg>
            </div>
          </a-tooltip>
          
          <a-tooltip title="多边形 (Polygon)" placement="right">
            <div class="tool-icon-btn" :class="{ active: currentTool === 'polygon' }" @click="selectTool('polygon')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l9 4.9V17L12 22l-9-4.9V7z"></path>
              </svg>
            </div>
          </a-tooltip>

          <a-tooltip title="手绘 (Freehand)" placement="right">
            <div class="tool-icon-btn" :class="{ active: currentTool === 'freehand' }" @click="selectTool('freehand')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
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
            <a-card 
              v-for="(item, index) in historyLog" 
              :key="index" 
              size="small" 
              class="history-item-card" 
              :bordered="false"
              :bodyStyle="{ padding: '8px 12px' }"
            >
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
import { onMounted, onUnmounted, ref } from 'vue'
import { BladeFire } from '../blade-fire/index.js'

const currentTool = ref('')
const selectionInfo = ref([])
const historyLog = ref([])
let activeToolCleanup = null
let selectionCleanup = null
let historyCleanup = null
let bladeFireCleanup = null

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
  const instance = BladeFire.init({ container: 'map-container', grid: true, gridSize: 40, zoom: true })
  if (instance && instance.destroy) {
    bladeFireCleanup = instance.destroy
  }

  selectionCleanup = BladeFire.onSelectionChange((info) => {
    selectionInfo.value = info
  })

  historyCleanup = BladeFire.onHistoryChange((stack) => {
    historyLog.value = [...stack]
  })
})

onUnmounted(() => {
  if (selectionCleanup) selectionCleanup()
  if (historyCleanup) historyCleanup()
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

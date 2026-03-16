<template>
  <a-layout class="layout-container">
    <a-layout-sider theme="light" width="200" class="left-sider">
      <div class="toolbar">
        <div class="toolbar-title">工具</div>
        <a-button block class="tool-btn" :type="currentTool === 'select' ? 'primary' : 'default'"
          @click="selectTool('select')">Select</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'circle' ? 'primary' : 'default'"
          @click="selectTool('circle')">Circle</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'rect' ? 'primary' : 'default'"
          @click="selectTool('rect')">Rect</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'triangle' ? 'primary' : 'default'"
          @click="selectTool('triangle')">Triangle</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'polygon' ? 'primary' : 'default'"
          @click="selectTool('polygon')">Polygon</a-button>
        <!-- <a-button block class="tool-btn" :type="currentTool === 'text' ? 'primary' : 'default'" @click="selectTool('text')">Text</a-button> -->
      </div>
    </a-layout-sider>
    <a-layout-content class="content-area">
      <div id="map-container"></div>
    </a-layout-content>
    <a-layout-sider theme="light" width="300" class="right-sider">
      <div class="properties-panel">
        <div class="panel-title">属性</div>
        <div class="panel-content">
          <div v-if="selectionInfo.length === 0" class="empty-state">未选中任何图形</div>
          <div v-else>
            <div v-for="(item, idx) in selectionInfo" :key="idx" class="prop-item">
              <div class="prop-header">{{ item.tagName }}</div>
              <div class="prop-row">
                <span class="label">Width:</span>
                <span class="value">{{ Math.round(item.width) }}</span>
              </div>
              <div class="prop-row">
                <span class="label">Height:</span>
                <span class="value">{{ Math.round(item.height) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-title history-title">历史消息</div>
        <div class="panel-content history-container">
          <div v-if="historyLog.length === 0" class="empty-state">暂无历史记录</div>
          <div v-else class="history-list">
            <div v-for="(item, index) in historyLog" :key="index" class="history-item">
              <span class="index">{{ index + 1 }}.</span>
              <span class="desc">{{ item.desc || 'Unknown Action' }}</span>
            </div>
          </div>
        </div>
      </div>
    </a-layout-sider>
  </a-layout>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { BladeFire } from '../blade-fire/index.js'
import { history } from '../blade-fire/common/index.js'

const currentTool = ref('')
const selectionInfo = ref([])
const historyLog = ref([])
let activeToolCleanup = null
let selectionCleanup = null
let historyCleanup = null

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
  BladeFire.init({ container: 'map-container', grid: true, gridSize: 40, zoom: true })

  selectionCleanup = BladeFire.onSelectionChange((info) => {
    selectionInfo.value = info
  })

  historyCleanup = history.subscribe((stack) => {
    historyLog.value = [...stack]
  })
})

onUnmounted(() => {
  if (selectionCleanup) selectionCleanup()
  if (historyCleanup) historyCleanup()
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

.toolbar-title,
.panel-title {
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 16px;
  color: #333;
}

.properties-panel {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.empty-state {
  color: #999;
  font-size: 14px;
  text-align: center;
  padding: 20px 0;
}

.prop-item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
  background-color: #fafafa;
}

.prop-header {
  font-weight: bold;
  margin-bottom: 8px;
  text-transform: capitalize;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
}

.prop-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 14px;
}

.label {
  color: #666;
}

.value {
  font-family: monospace;
}

.history-title {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.history-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  background-color: #f9f9f9;
  border-radius: 4px;
  font-size: 13px;
}

.index {
  color: #999;
  min-width: 20px;
}

.desc {
  color: #333;
}
</style>

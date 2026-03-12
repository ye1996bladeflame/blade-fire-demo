<template>
  <div id="map-container"></div>
</template>
<script setup>
import { onMounted } from 'vue'
import { BladeFire } from '../blade-fire/index.js'

onMounted(() => {
  BladeFire.init({ container: 'map-container', grid: true, zoom: true })
})
</script>
<style scoped>
#map-container {
  width: 80%;
  height: 80%;
  box-sizing: border-box;
  border: 1px solid #1d4d7a;
}
</style>

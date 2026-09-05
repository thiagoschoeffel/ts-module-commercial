<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import {
  Alert, Badge, Button, Card, CheckIcon, ClipboardListIcon, Drawer, InfoIcon, Progress, TriangleAlertIcon
} from '@thiagoschoeffel/ts-components'
import { formatMenuDate, importDailyMenus } from '../../mocks/menuStore'
import {
  downloadMenuSpreadsheetTemplate, readMenuSpreadsheet, type MenuSpreadsheetPreview
} from '../../services/menuSpreadsheet'

const emit = defineEmits<{ imported: [dates: string[]] }>()
const open = ref(false)
const input = ref<HTMLInputElement>()
const preview = shallowRef<MenuSpreadsheetPreview>()
const reading = ref(false)
const importing = ref(false)
const dragging = ref(false)
const readProgress = ref(0)
const importProgress = ref(0)
const importingDate = ref('')
const importedDates = ref<string[]>([])
const serverSkippedDates = ref<string[]>([])
const serverIssues = ref<string[]>([])
const canImport = computed(() => Boolean(preview.value?.menus.length) && !preview.value?.issues.length)
const readProgressDescription = computed(() => {
  if (readProgress.value < 30) return 'Carregando o arquivo'
  if (readProgress.value < 75) return 'Interpretando as abas e colunas'
  if (readProgress.value < 100) return 'Validando os cardápios'
  return 'Verificação concluída'
})
let processingRun = 0

function wait(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds))
}

function reset() {
  processingRun += 1
  preview.value = undefined
  importedDates.value = []
  serverSkippedDates.value = []
  serverIssues.value = []
  dragging.value = false
  reading.value = false
  importing.value = false
  readProgress.value = 0
  importProgress.value = 0
  importingDate.value = ''
  if (input.value) input.value.value = ''
}

watch(open, value => { if (!value) reset() })

async function selectFile(file?: File) {
  if (!file) return
  const run = ++processingRun
  const startedAt = performance.now()
  reading.value = true
  readProgress.value = 0
  preview.value = undefined
  importedDates.value = []
  try {
    const result = await readMenuSpreadsheet(file, value => {
      if (run === processingRun) readProgress.value = value
    })
    await wait(Math.max(0, 600 - (performance.now() - startedAt)))
    if (run === processingRun) preview.value = result
  }
  finally {
    if (run === processingRun) reading.value = false
  }
}

function handleInput(event: Event) {
  void selectFile((event.target as HTMLInputElement).files?.[0])
}

function handleDrop(event: DragEvent) {
  dragging.value = false
  void selectFile(event.dataTransfer?.files[0])
}

async function importMenus() {
  if (!preview.value || !canImport.value) return
  const menus = preview.value.menus
  const startedAt = performance.now()
  importing.value = true
  importProgress.value = 5
  try {
    importingDate.value = menus[0]?.date ?? ''
    const report = await importDailyMenus(menus)
    const dates = report.createdDates
    serverSkippedDates.value = report.skippedDates
    serverIssues.value = report.issues.map(issue => issue.message)
    importProgress.value = 95
    await wait(Math.max(0, 600 - (performance.now() - startedAt)))
    importProgress.value = 100
    await wait(150)
    importedDates.value = dates
    if (!serverIssues.value.length) { emit('imported', dates); preview.value = undefined }
  }
  finally { importing.value = false }
}
</script>

<template>
  <Drawer
    v-model:open="open"
    size="large"
    title="Importar cardápios"
    description="Preencha o modelo do Excel, confira os dados e importe os dias como rascunho.">
    <template #trigger>
      <Button type="button" variant="secondary">Importar planilha</Button>
    </template>

    <div class="space-y-4">
      <Alert variants="info" size="small" title="Use sempre o modelo atualizado" description="Ele contém os itens produzíveis, ofertas e instruções compatíveis com o catálogo atual.">
        <template #icon><InfoIcon /></template>
        <template #actions>
          <Button type="button" size="small" variant="secondary" :disabled="reading || importing" @click="downloadMenuSpreadsheetTemplate">
            Baixar modelo .xlsx
          </Button>
        </template>
      </Alert>

      <Alert
        v-if="importedDates.length"
        variants="success"
        title="Importação concluída"
        :description="`${importedDates.length} ${importedDates.length === 1 ? 'cardápio foi criado' : 'cardápios foram criados'} como rascunho.`">
        <template #icon><CheckIcon /></template>
      </Alert>
      <Alert v-if="serverSkippedDates.length" variants="warning" title="Dias existentes foram preservados"
        :description="serverSkippedDates.map(date => formatMenuDate(date)).join(', ')" />
      <Alert v-if="serverIssues.length" variants="danger" title="A API rejeitou a importação"
        :description="serverIssues.join(' ')" />

      <template v-else>
        <div>
          <input ref="input" class="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="handleInput">
          <Card v-if="reading">
            <div class="flex items-baseline justify-between gap-3">
              <div>
                <p class="font-medium text-slate-800">Processando planilha</p>
                <p class="mt-1 text-xs text-slate-500">{{ readProgressDescription }}</p>
              </div>
              <span class="text-xs font-medium tabular-nums text-blue-700">{{ readProgress }}%</span>
            </div>
            <Progress class="mt-4" :value="readProgress" variant="info" label="Processamento da planilha" />
          </Card>
          <button
            v-else-if="!importing"
            type="button"
            class="flex min-h-36 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-5 py-6 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40"
            :class="dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-500 hover:bg-slate-50'"
            @click="input?.click()"
            @dragenter.prevent="dragging = true"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="handleDrop">
            <ClipboardListIcon class="size-7 text-slate-400" aria-hidden="true" />
            <span class="mt-3 font-medium text-slate-800">Selecione ou arraste a planilha</span>
            <span class="mt-1 text-xs text-slate-500">Arquivo .xlsx de até 5 MB</span>
          </button>
        </div>

        <Card v-if="importing">
          <div class="flex items-baseline justify-between gap-3">
            <div>
              <p class="font-medium text-slate-800">Importando cardápios</p>
              <p class="mt-1 text-xs text-slate-500">{{ importingDate ? `Gravando ${formatMenuDate(importingDate)}` : 'Preparando a importação' }}</p>
            </div>
            <span class="text-xs font-medium tabular-nums text-blue-700">{{ importProgress }}%</span>
          </div>
          <Progress class="mt-4" :value="importProgress" variant="info" label="Importação dos cardápios" />
        </Card>

        <template v-else-if="preview">
          <Alert
            v-if="preview.issues.length"
            variants="danger"
            title="A planilha precisa de ajustes"
            description="Corrija os itens abaixo e selecione o arquivo novamente.">
            <template #icon><TriangleAlertIcon /></template>
          </Alert>

          <Card v-if="preview.issues.length">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h3 class="font-medium text-slate-800">Problemas encontrados</h3>
                <Badge variant="danger" size="small">{{ preview.issues.length }}</Badge>
              </div>
            </template>
            <ul class="space-y-2 text-xs text-slate-600">
              <li v-for="(issue, index) in preview.issues" :key="`${issue.sheet}-${issue.row}-${index}`" class="flex gap-2">
                <span class="text-red-500" aria-hidden="true">•</span>
                <span><strong v-if="issue.sheet" class="font-medium text-slate-700">{{ issue.sheet }}<template v-if="issue.row">, linha {{ issue.row }}</template>: </strong>{{ issue.message }}</span>
              </li>
            </ul>
          </Card>

          <Alert
            v-if="preview.skippedDates.length"
            variants="warning"
            title="Cardápios existentes não serão substituídos"
            :description="preview.skippedDates.map(date => formatMenuDate(date)).join(', ')" />

          <Card v-if="preview.menus.length">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="font-medium text-slate-800">Prontos para importar</h3>
                  <p class="mt-0.5 text-xs text-slate-500">{{ preview.fileName }}</p>
                </div>
                <Badge variant="neutral" size="small">{{ preview.menus.length }}</Badge>
              </div>
            </template>
            <div class="divide-y divide-slate-100">
              <div v-for="menu in preview.menus" :key="menu.date" class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p class="font-medium text-slate-800">{{ formatMenuDate(menu.date, true) }}</p>
                  <p class="mt-0.5 text-xs text-slate-500">{{ menu.options.length }} opções · {{ menu.offers.length }} ofertas</p>
                </div>
                <Badge variant="neutral" size="small">Rascunho</Badge>
              </div>
            </div>
          </Card>
        </template>
      </template>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" :disabled="reading || importing" @click="open = false">{{ importedDates.length ? 'Concluir' : 'Cancelar' }}</Button>
        <Button v-if="!importedDates.length" type="button" :disabled="!canImport" :loading="importing" @click="importMenus">
          Importar {{ preview?.menus.length || '' }} {{ preview?.menus.length === 1 ? 'cardápio' : 'cardápios' }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>

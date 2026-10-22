<template>
  <div class="candidate-list">
    <a-card :bordered="false" class="fm-filters">
      <a-form-model layout="inline" :model="filters">
        <a-form-model-item :label="$t('factorMining.candidates.status')">
          <a-select
            v-model="filters.status"
            style="width: 160px"
            allow-clear
            :placeholder="$t('factorMining.candidates.anyStatus')"
          >
            <a-select-option value="search">{{ statusLabel('search') }}</a-select-option>
            <a-select-option value="frozen">{{ statusLabel('frozen') }}</a-select-option>
            <a-select-option value="rejected">{{ statusLabel('rejected') }}</a-select-option>
          </a-select>
        </a-form-model-item>

        <a-form-model-item :label="$t('factorMining.candidates.market')">
          <a-select
            v-model="filters.market"
            style="width: 150px"
            allow-clear
            :placeholder="$t('factorMining.candidates.anyMarket')"
          >
            <a-select-option v-for="key in markets" :key="key" :value="key">
              {{ marketLabel(key) }}
            </a-select-option>
          </a-select>
        </a-form-model-item>

        <a-form-model-item :label="$t('factorMining.candidates.runId')" html-for="fm-candidate-run-id">
          <a-input-number
            id="fm-candidate-run-id"
            v-model="filters.runId"
            :min="1"
            :precision="0"
            style="width: 140px"
            :placeholder="$t('factorMining.candidates.runIdPlaceholder')"
          />
        </a-form-model-item>

        <a-form-model-item>
          <a-space>
            <a-button type="primary" icon="search" @click="search">{{ $t('factorMining.actions.search') }}</a-button>
            <a-button @click="reset">{{ $t('factorMining.actions.reset') }}</a-button>
          </a-space>
        </a-form-model-item>
      </a-form-model>
      <div class="fm-note">{{ $t('factorMining.candidates.runIdNote') }}</div>
    </a-card>

    <a-table
      :columns="columns"
      :data-source="items"
      :loading="loading"
      :pagination="false"
      :row-key="record => record.id"
      size="middle"
    >
      <template slot="status" slot-scope="text">
        <a-tag :color="statusColor(text)">{{ statusLabel(text) }}</a-tag>
      </template>

      <template slot="hash" slot-scope="text">
        <a-tooltip :title="text">
          <span class="fm-mono">{{ shortHash(text) }}</span>
        </a-tooltip>
      </template>

      <template slot="createdAt" slot-scope="text">
        {{ formatTime(text) }}
      </template>

      <template slot="action" slot-scope="text, record">
        <a @click="openDetail(record)">{{ $t('factorMining.actions.view') }}</a>
      </template>

      <template slot="expandedRowRender" slot-scope="record">
        <div class="fm-expanded">
          <a-descriptions :column="3" size="small" bordered>
            <a-descriptions-item :label="$t('factorMining.candidates.origin')">
              {{ record.origin || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.candidates.reason')" :span="2">
              {{ record.reason ? message(record.reason) : '-' }}
            </a-descriptions-item>
          </a-descriptions>
          <pre class="fm-json">{{ pretty(record.expression) }}</pre>
        </div>
      </template>
    </a-table>

    <a-empty v-if="!loading && !items.length" :description="$t('factorMining.candidates.empty')" />

    <div v-if="items.length || offset > 0" class="fm-pager">
      <a-button :disabled="offset === 0" @click="prevPage">{{ $t('factorMining.candidates.prev') }}</a-button>
      <span class="fm-page">{{ pageLabel }}</span>
      <a-button :disabled="!hasNext" @click="nextPage">{{ $t('factorMining.candidates.next') }}</a-button>
    </div>

    <a-modal
      v-model="detailVisible"
      :title="$t('factorMining.candidates.detail')"
      :width="900"
      :footer="null"
    >
      <div v-if="detail">
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item :label="$t('factorMining.candidates.id')">{{ detail.id }}</a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.status')">
            <a-tag :color="statusColor(detail.status)">{{ statusLabel(detail.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.market')">
            {{ detail.market }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.jobs.timeframe')">
            {{ detail.timeframe }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.template')">
            {{ detail.templateId || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.origin')">
            {{ detail.origin || '-' }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.runId')">
            {{ detail.runId === null ? '-' : detail.runId }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.createdAt')">
            {{ formatTime(detail.createdAt) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.fingerprint')" :span="2">
            <span class="fm-mono">{{ detail.expressionHash }}</span>
          </a-descriptions-item>
        </a-descriptions>

        <a-alert
          v-if="detail.reason"
          type="warning"
          show-icon
          style="margin-top: 16px"
          :message="$t('factorMining.candidates.reason')"
          :description="message(detail.reason)"
        />

        <a-divider>{{ $t('factorMining.candidates.metrics') }}</a-divider>
        <a-descriptions :column="3" bordered size="small">
          <a-descriptions-item :label="$t('factorMining.candidates.coverage')">
            {{ num(detail.metrics.coverage) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.rankIc')">
            {{ num(detail.metrics.rankIc) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.icir')">
            {{ num(detail.metrics.icir) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.averageTurnover')">
            {{ num(detail.metrics.averageTurnover) }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('factorMining.candidates.foldSigns')" :span="2">
            {{ (detail.metrics.foldIcSigns || []).join(', ') || '-' }}
          </a-descriptions-item>
        </a-descriptions>

        <template v-if="hasOutOfSample">
          <a-divider>{{ $t('factorMining.candidates.outOfSample') }}</a-divider>
          <a-descriptions :column="3" bordered size="small">
            <a-descriptions-item :label="$t('factorMining.candidates.coverage')">
              {{ num(detail.outOfSample.coverage) }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.candidates.rankIc')">
              {{ num(detail.outOfSample.rankIc) }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('factorMining.candidates.icir')">
              {{ num(detail.outOfSample.icir) }}
            </a-descriptions-item>
          </a-descriptions>
        </template>
        <a-alert
          v-else
          type="info"
          show-icon
          style="margin-top: 16px"
          :message="$t('factorMining.candidates.noOutOfSample')"
        />

        <a-divider>{{ $t('factorMining.candidates.expression') }}</a-divider>
        <pre class="fm-json">{{ pretty(detail.expression) }}</pre>
      </div>
    </a-modal>
  </div>
</template>

<script>
import { getCandidates, getCandidateDetail } from '@/api/factor-mining'
import moment from 'moment'

const PAGE_SIZE = 50
const MARKETS = ['Crypto', 'USStock', 'CNStock', 'HKStock', 'Forex', 'Futures', 'MOEX']

export default {
  name: 'CandidateList',
  props: {
    runId: { type: Number, default: undefined }
  },
  data () {
    return {
      markets: MARKETS,
      items: [],
      loading: false,
      requestVersion: 0,
      offset: 0,
      hasNext: false,
      filters: { status: undefined, market: undefined, runId: this.runId },
      detail: null,
      detailVisible: false
    }
  },
  watch: {
    runId (value) {
      this.filters = { ...this.filters, runId: value }
      this.offset = 0
      return this.load()
    }
  },
  computed: {
    pageLabel () {
      return `${Math.floor(this.offset / PAGE_SIZE) + 1}`
    },
    hasOutOfSample () {
      return !!(this.detail && this.detail.outOfSample &&
        Object.keys(this.detail.outOfSample).length)
    },
    columns () {
      return [
        { title: this.$t('factorMining.candidates.id'), dataIndex: 'id', width: 70 },
        {
          title: this.$t('factorMining.candidates.status'),
          dataIndex: 'status',
          width: 110,
          scopedSlots: { customRender: 'status' }
        },
        { title: this.$t('factorMining.candidates.market'), dataIndex: 'market', width: 110 },
        { title: this.$t('factorMining.jobs.timeframe'), dataIndex: 'timeframe', width: 100 },
        { title: this.$t('factorMining.candidates.template'), dataIndex: 'templateId', width: 180 },
        {
          title: this.$t('factorMining.candidates.fingerprint'),
          dataIndex: 'expressionHash',
          width: 160,
          scopedSlots: { customRender: 'hash' }
        },
        {
          title: this.$t('factorMining.candidates.createdAt'),
          dataIndex: 'createdAt',
          width: 170,
          scopedSlots: { customRender: 'createdAt' }
        },
        { title: this.$t('common.actions'), width: 90, scopedSlots: { customRender: 'action' } }
      ]
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    statusLabel (status) {
      const key = `factorMining.candidateStatus.${status}`
      const text = this.$t(key)
      return text === key ? status : text
    },
    statusColor (status) {
      return { search: 'blue', frozen: 'green', rejected: 'default' }[status] || 'default'
    },
    marketLabel (key) {
      const label = this.$t(`factorMining.markets.${key}`)
      return label === `factorMining.markets.${key}` ? key : label
    },
    message (key) {
      const text = this.$t(key)
      return text === key ? key : text
    },
    num (value) {
      return value === null || value === undefined ? '-' : Number(value).toFixed(4)
    },
    shortHash (hash) {
      return hash ? `${hash.slice(0, 12)}…` : '-'
    },
    formatTime (value) {
      return value ? moment(value).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    pretty (value) {
      return value ? JSON.stringify(value, null, 2) : '-'
    },
    async load () {
      const requestVersion = ++this.requestVersion
      this.loading = true
      try {
        const params = { limit: PAGE_SIZE, offset: this.offset }
        // Only meaningful filters travel: an empty string is not "no filter" to the repository,
        // it is a value that matches nothing.
        if (this.filters.status) params.status = this.filters.status
        if (this.filters.market) params.market = this.filters.market
        if (this.filters.runId) params.runId = this.filters.runId
        const res = await getCandidates(params)
        if (requestVersion !== this.requestVersion) return
        if (res.code !== 1) {
          this.$message.error(this.message(res.msg))
          return
        }
        this.items = res.data.items || []
        // No total is served, so a next page is offered while the last one came back full.
        this.hasNext = this.items.length === PAGE_SIZE
      } catch (error) {
        if (requestVersion === this.requestVersion) this.$message.error(this.$t('factorMining.candidates.loadFailed'))
      } finally {
        if (requestVersion === this.requestVersion) this.loading = false
      }
    },
    search () {
      this.offset = 0
      const runId = Number.isSafeInteger(this.filters.runId) && this.filters.runId > 0 ? this.filters.runId : undefined
      this.filters.runId = runId
      if (runId !== this.runId) {
        this.$emit('filter-run', runId)
        return
      }
      this.load()
    },
    reset () {
      this.filters = { status: undefined, market: undefined, runId: undefined }
      this.offset = 0
      if (this.runId !== undefined) {
        this.$emit('filter-run', undefined)
        return
      }
      this.load()
    },
    prevPage () {
      this.offset = Math.max(0, this.offset - PAGE_SIZE)
      this.load()
    },
    nextPage () {
      this.offset += PAGE_SIZE
      this.load()
    },
    async openDetail (record) {
      try {
        const res = await getCandidateDetail(record.id)
        if (res.code !== 1) {
          this.$message.error(this.message(res.msg))
          return
        }
        this.detail = res.data
        this.detailVisible = true
      } catch (error) {
        this.$message.error(this.$t('factorMining.candidates.loadFailed'))
      }
    }
  }
}
</script>

<style lang="less" scoped>
.fm-filters {
  margin-bottom: 16px;
}

.fm-note {
  margin-top: 8px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.fm-expanded {
  background: #fafafa;
  padding: 12px;
}

.fm-json {
  margin: 12px 0 0;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
  max-height: 320px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
}

.fm-mono {
  font-family: monospace;
}

.fm-pager {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 16px;
}

.fm-page {
  margin: 0 16px;
  color: rgba(0, 0, 0, 0.65);
}
</style>

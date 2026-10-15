<template>
  <div class="submit-job">
    <a-card :title="$t('factorMining.submit.configTitle')" :bordered="false">
      <a-form-model
        ref="form"
        :model="form"
        :rules="rules"
        :label-col="{ span: 7 }"
        :wrapper-col="{ span: 14 }"
      >
        <a-form-model-item :label="$t('factorMining.submit.sourceId')" prop="sourceId">
          <a-input-number
            v-model="form.sourceId"
            :min="1"
            :placeholder="$t('factorMining.submit.sourceIdPlaceholder')"
            style="width: 100%"
          />
          <span class="fm-hint">{{ $t('factorMining.submit.sourceIdExtra') }}</span>
        </a-form-model-item>

        <a-form-model-item :label="$t('factorMining.submit.market')" prop="market">
          <a-select v-model="form.market" :placeholder="$t('factorMining.submit.marketPlaceholder')">
            <a-select-option v-for="key in markets" :key="key" :value="key">
              {{ marketLabel(key) }}
            </a-select-option>
          </a-select>
        </a-form-model-item>

        <a-form-model-item :label="$t('factorMining.submit.timeframe')" prop="timeframe">
          <a-select v-model="form.timeframe" :placeholder="$t('factorMining.submit.timeframePlaceholder')">
            <a-select-option v-for="tf in timeframes" :key="tf" :value="tf">{{ tf }}</a-select-option>
          </a-select>
        </a-form-model-item>

        <a-form-model-item :label="$t('factorMining.submit.startDate')" prop="startDate">
          <a-date-picker
            v-model="form.startDate"
            value-format="YYYY-MM-DD"
            :placeholder="$t('factorMining.submit.startDatePlaceholder')"
            style="width: 100%"
          />
        </a-form-model-item>

        <a-form-model-item :label="$t('factorMining.submit.endDate')" prop="endDate">
          <a-date-picker
            v-model="form.endDate"
            value-format="YYYY-MM-DD"
            :placeholder="$t('factorMining.submit.endDatePlaceholder')"
            style="width: 100%"
          />
        </a-form-model-item>

        <a-form-model-item :label="$t('factorMining.submit.budget')" prop="budget">
          <a-input-number v-model="form.budget" :min="1" :max="maxBudget" style="width: 100%" />
          <span class="fm-hint">{{ $t('factorMining.submit.budgetExtra') }}</span>
        </a-form-model-item>

        <a-form-model-item :label="$t('factorMining.submit.seed')" prop="seed">
          <a-input-number v-model="form.seed" style="width: 100%" />
          <span class="fm-hint">{{ $t('factorMining.submit.seedExtra') }}</span>
        </a-form-model-item>

        <a-collapse :bordered="false" style="margin-bottom: 24px">
          <a-collapse-panel key="advanced" :header="$t('factorMining.submit.advanced')">
            <a-form-model-item :label="$t('factorMining.submit.freezeRatio')">
              <a-input-number
                v-model="form.freezeRatio"
                :min="0.05"
                :max="0.45"
                :step="0.05"
                style="width: 100%"
              />
              <span class="fm-hint">{{ $t('factorMining.submit.freezeRatioExtra') }}</span>
            </a-form-model-item>

            <a-form-model-item :label="$t('factorMining.submit.groups')">
              <a-input-number v-model="form.groups" :min="2" style="width: 100%" />
            </a-form-model-item>

            <a-form-model-item :label="$t('factorMining.submit.holdingPeriod')">
              <a-input-number v-model="form.holdingPeriod" :min="1" style="width: 100%" />
            </a-form-model-item>

            <a-form-model-item :label="$t('factorMining.submit.commission')">
              <a-input-number
                v-model="form.commission"
                :min="0"
                :max="1"
                :step="0.0001"
                style="width: 100%"
              />
            </a-form-model-item>

            <a-form-model-item :label="$t('factorMining.submit.slippage')">
              <a-input-number
                v-model="form.slippage"
                :min="0"
                :max="1"
                :step="0.0001"
                style="width: 100%"
              />
            </a-form-model-item>
          </a-collapse-panel>
        </a-collapse>

        <a-alert
          v-if="estimate"
          type="info"
          show-icon
          :message="$t('factorMining.submit.estimateTitle')"
          style="margin-bottom: 24px"
        >
          <template slot="description">
            <div>{{ $t('factorMining.submit.estimateTemplates') }}: {{ estimate.templateCount }}</div>
            <div>{{ $t('factorMining.submit.estimateCandidates') }}: {{ estimate.candidateBudget }}</div>
          </template>
        </a-alert>

        <a-form-model-item :wrapper-col="{ span: 14, offset: 7 }">
          <a-space>
            <a-button type="primary" :loading="estimating" @click="handleEstimate">
              {{ $t('factorMining.submit.estimate') }}
            </a-button>
            <a-button
              type="primary"
              :disabled="!estimate"
              :loading="submitting"
              @click="handleSubmit"
            >
              {{ $t('factorMining.submit.submit') }}
            </a-button>
          </a-space>
        </a-form-model-item>
      </a-form-model>
    </a-card>
  </div>
</template>

<script>
import { estimateJob, submitJob } from '@/api/factor-mining'

const MARKETS = ['Crypto', 'USStock', 'CNStock', 'HKStock', 'Forex', 'Futures', 'MOEX']
const TIMEFRAMES = ['5m', '15m', '1H', '4H', '1D', '1W']

export default {
  name: 'SubmitJob',
  data () {
    return {
      markets: MARKETS,
      timeframes: TIMEFRAMES,
      maxBudget: 2000,
      // The payload is built from these same names, so what is sent is what ``POST /run`` reads:
      // its whitelist drops every key the run config does not know, silently.
      form: {
        sourceId: null,
        market: 'USStock',
        timeframe: '1D',
        startDate: '',
        endDate: '',
        budget: 400,
        seed: 42,
        freezeRatio: 0.3,
        groups: 10,
        holdingPeriod: 5,
        commission: 0.001,
        slippage: 0.0005
      },
      rules: {
        sourceId: [{ required: true, message: this.$t('factorMining.submit.sourceIdRequired'), trigger: 'blur' }],
        market: [{ required: true, message: this.$t('factorMining.submit.marketRequired'), trigger: 'change' }],
        timeframe: [{ required: true, message: this.$t('factorMining.submit.timeframeRequired'), trigger: 'change' }],
        startDate: [{ required: true, message: this.$t('factorMining.submit.startDateRequired'), trigger: 'change' }],
        endDate: [{ required: true, message: this.$t('factorMining.submit.endDateRequired'), trigger: 'change' }]
      },
      estimating: false,
      submitting: false,
      estimate: null
    }
  },
  methods: {
    marketLabel (key) {
      const label = this.$t(`factorMining.markets.${key}`)
      return label === `factorMining.markets.${key}` ? key : label
    },
    // The service answers every rejection as an i18n key in ``msg``; render it when the bundle
    // knows the key and fall back to the key itself, which is still actionable.
    message (key) {
      const text = this.$t(key)
      return text === key ? key : text
    },
    async handleEstimate () {
      const valid = await this.$refs.form.validate().catch(() => false)
      if (!valid) return
      this.estimating = true
      try {
        const res = await estimateJob({ ...this.form })
        if (res.code !== 1) {
          this.$message.error(this.message(res.msg))
          return
        }
        this.estimate = res.data
      } catch (error) {
        this.$message.error(this.failureMessage(error, 'factorMining.estimateFailed'))
      } finally {
        this.estimating = false
      }
    },
    async handleSubmit () {
      const valid = await this.$refs.form.validate().catch(() => false)
      if (!valid) return
      this.submitting = true
      try {
        const res = await submitJob({ ...this.form })
        if (res.code !== 1) {
          this.$message.error(this.message(res.msg))
          return
        }
        this.$message.success(this.$t('factorMining.submit.submitSuccess'))
        this.estimate = null
        this.$emit('submitted')
      } catch (error) {
        this.$message.error(this.failureMessage(error, 'factorMining.submit.submitFailed'))
      } finally {
        this.submitting = false
      }
    },
    failureMessage (error, fallback) {
      const envelope = error && error.response && error.response.data
      const key = envelope && envelope.msg
      return key ? this.message(key) : this.$t(fallback)
    }
  }
}
</script>

<style lang="less" scoped>
.fm-hint {
  display: block;
  margin-top: 4px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.4;
}
</style>

import request from '@/utils/request'

/**
 * The DSL's own vocabulary: fields, operators and hypothesis templates.
 */
export function getCatalog () {
  return request({
    url: '/api/factor-mining/catalog',
    method: 'get'
  })
}

/**
 * Price a search without reading a source, building a panel, or opening a job.
 */
export function estimateJob (data) {
  return request({
    url: '/api/factor-mining/estimate',
    method: 'post',
    data
  })
}

/**
 * Queue one mining run. Answers 202 with the job receipt, not a result.
 */
export function submitJob (data) {
  return request({
    url: '/api/factor-mining/run',
    method: 'post',
    data
  })
}

/**
 * The caller's mining jobs, newest first. Each row withholds its result behind `hasResult`.
 */
export function getJobs (params) {
  return request({
    url: '/api/factor-mining/jobs',
    method: 'get',
    params
  })
}

/**
 * One job with the run record the listing leaves out.
 */
export function getJobDetail (id) {
  return request({
    url: `/api/factor-mining/jobs/${id}`,
    method: 'get'
  })
}

/**
 * Stop one of the caller's jobs; the runner halts at its next progress report.
 */
export function cancelJob (id) {
  return request({
    url: `/api/factor-mining/jobs/${id}/cancel`,
    method: 'post'
  })
}

/**
 * The proposals an AI job's run recorded, in generation order. A running job answers what it has
 * written so far; a job that never opened a run reads as not found.
 */
export function getJobProposals (jobId, params = {}) {
  return request({
    url: `/api/factor-mining/jobs/${jobId}/proposals`,
    method: 'get',
    params
  })
}

/**
 * The candidate library. `runId`, `status`, `market`, `limit` and `offset` are the repository's
 * own filters; a row from this read carries no metrics.
 */
export function getCandidates (params) {
  return request({
    url: '/api/factor-mining/candidates',
    method: 'get',
    params
  })
}

/**
 * One candidate with the metrics and out-of-sample block the listing leaves out.
 */
export function getCandidateDetail (id) {
  return request({
    url: `/api/factor-mining/candidates/${id}`,
    method: 'get'
  })
}

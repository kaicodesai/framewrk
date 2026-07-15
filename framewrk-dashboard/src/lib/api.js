const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'
const TOKEN_KEY = 'framewrk_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message =
      res.status === 404
        ? `Not built yet (${path})`
        : body.detail
          ? `${body.error ?? 'Error'}: ${body.detail}`
          : (body.error ?? `Request failed (${res.status})`)
    throw new ApiError(message, res.status)
  }

  return res.status === 204 ? null : res.json()
}

export const api = {
  listProspects: () => request('/prospects'),
  createProspect: (fields) =>
    request('/prospects', {
      method: 'POST',
      body: JSON.stringify(fields),
    }),
  getProspect: (id) => request(`/prospects/${id}`),
  updateProspect: (id, fields) =>
    request(`/prospects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),
  markProspectLost: (id, reason) =>
    request(`/prospects/${id}/mark-lost`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  startBuild: (id, serviceTier) =>
    request(`/prospects/${id}/build`, {
      method: 'POST',
      body: JSON.stringify({ service_tier: serviceTier }),
    }),
  getBuild: (id) => request(`/builds/${id}`),
  getBuildJobs: (id) => request(`/builds/${id}/jobs`),
  submitPreview: (buildId, previewUrl) =>
    request(`/builds/${buildId}/submit-preview`, {
      method: 'POST',
      body: JSON.stringify({ preview_url: previewUrl }),
    }),
  sendPaymentLink: (id) => request(`/prospects/${id}/send-payment-link`, { method: 'POST' }),
  getHandover: (paymentId) => request(`/payments/${paymentId}/handover`),
  addActivity: (prospectId, fields) =>
    request(`/prospects/${prospectId}/activities`, {
      method: 'POST',
      body: JSON.stringify(fields),
    }),
  bulkCreateProspects: (prospects) =>
    request('/prospects/bulk', {
      method: 'POST',
      body: JSON.stringify({ prospects }),
    }),
}

export async function checkConnection() {
  try {
    await api.listProspects()
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}

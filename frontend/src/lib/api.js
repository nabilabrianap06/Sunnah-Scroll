import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const fetchFeed = (limit = 30) =>
  api.get('/feed', { params: { limit } }).then((r) => r.data)

export const refreshFeed = (limit = 30) =>
  api.post('/feed/refresh', null, { params: { limit } }).then((r) => r.data)

export default api

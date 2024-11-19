import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8081', // ou a URL da sua API
  // outras configurações, se necessário
});

export default api;
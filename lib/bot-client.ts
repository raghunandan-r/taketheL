export class LTrainClient {
  private baseUrl: string
  private authToken: string

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl
    this.authToken = authToken
  }

  private async request(action: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ action, ...body })
    })
    return response.json()
  }

  private async get(action: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/api/bot`)
    url.searchParams.set('action', action)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    })
    return response.json()
  }

  async register(stationId: string) {
    return this.request('register', { station_id: stationId })
  }

  async discover(stationId: string, limit = 10) {
    return this.request('discover', { station_id: stationId, limit })
  }

  async propose(targetUserId: string, stationId: string) {
    const idempotencyKey = `propose_${this.authToken}_${targetUserId}_${Date.now()}`
    return this.request('propose', {
      target_user_id: targetUserId,
      station_id: stationId,
      idempotency_key: idempotencyKey
    })
  }

  async respond(matchId: string, accept: boolean) {
    return this.request('respond', { match_id: matchId, accept })
  }

  async heartbeat(stationId: string) {
    return this.request('heartbeat', { station_id: stationId })
  }

  async getMatches() {
    return this.get('matches')
  }

  async getProposals() {
    return this.get('proposals')
  }
}

export function createLTrainClient(authToken: string): LTrainClient {
  return new LTrainClient(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', authToken)
}

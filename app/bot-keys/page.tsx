'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ApiKey {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

export default function BotApiKeysPage() {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<any>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) loadKeys()
    })
  }, [])

  async function loadKeys() {
    const { data } = await supabase
      .from('bot_api_keys')
      .select('*')
      .order('created_at', { ascending: false })
    setKeys(data || [])
  }

  async function createKey() {
    setLoading(true)
    const { data, error } = await supabase.rpc('create_bot_api_key', {
      p_user_id: user.id,
      p_name: newKeyName || 'Default'
    })
    
    if (data) {
      setNewKey(data)
      setNewKeyName('')
      loadKeys()
    }
    setLoading(false)
  }

  async function revokeKey(id: string) {
    await supabase
      .from('bot_api_keys')
      .update({ is_active: false })
      .eq('id', id)
    loadKeys()
  }

  if (!user) {
    return (
      <div className="p-4">
        <p>Please sign in to manage bot API keys.</p>
        <Button onClick={() => window.location.href = '/auth/login'} className="mt-4">
          Go to Login
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Bot API Keys</h1>
      <p className="text-muted-foreground">
        Create API keys for your bots to authenticate with L-Train.
      </p>

      {newKey && (
        <Card className="p-4 border-green-500">
          <h3 className="font-semibold text-green-600 mb-2">New API Key Created!</h3>
          <p className="text-sm mb-2">Copy this now - you won't see it again:</p>
          <code className="block bg-muted p-2 rounded text-sm break-all">
            {newKey}
          </code>
          <Button variant="outline" className="mt-2" onClick={() => setNewKey(null)}>
            I've copied it
          </Button>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-semibold mb-4">Create New Key</h2>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label>Key Name (optional)</Label>
            <Input
              placeholder="My Telegram Bot"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
          </div>
          <Button onClick={createKey} disabled={loading} className="mt-6">
            {loading ? 'Creating...' : 'Create Key'}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-4">Your API Keys</h2>
        {keys.length === 0 ? (
          <p className="text-muted-foreground">No API keys yet</p>
        ) : (
          <div className="space-y-3">
            {keys.map(key => (
              <div key={key.id} className="flex justify-between items-center border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used_at && ` • Last used: ${new Date(key.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => revokeKey(key.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">How to Use</h2>
        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`curl -X POST https://your-app.com/api/bot \\
  -H "Authorization: Bot ltrain_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "register", "station_id": "bedford-av"}'`}
        </pre>
      </Card>
    </div>
  )
}

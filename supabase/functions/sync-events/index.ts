import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting events sync...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { spreadsheetId } = await req.json()
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required')
    }

    // Authentication setup
    const credentialsStr = Deno.env.get('GOOGLE_SHEETS_CREDENTIALS')
    if (!credentialsStr) {
      throw new Error('Google Sheets credentials not found')
    }

    const credentials = JSON.parse(credentialsStr)
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Invalid credentials format')
    }

    // JWT Creation
    const privateKey = credentials.private_key.replace(/\\n/g, '\n')
    const now = Math.floor(Date.now() / 1000)
    
    const jwtHeader = btoa(JSON.stringify({
      alg: 'RS256',
      typ: 'JWT'
    }))
    
    const jwtClaimSet = btoa(JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    }))

    const signInput = `${jwtHeader}.${jwtClaimSet}`
    const encoder = new TextEncoder()
    const signBytes = encoder.encode(signInput)

    // Sign JWT
    const keyImportParams = {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    }

    const pemHeader = '-----BEGIN PRIVATE KEY-----'
    const pemFooter = '-----END PRIVATE KEY-----'
    const pemContents = privateKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '')

    const binaryKey = atob(pemContents)
    const binaryKeyBytes = new Uint8Array(binaryKey.length)
    for (let i = 0; i < binaryKey.length; i++) {
      binaryKeyBytes[i] = binaryKey.charCodeAt(i)
    }

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKeyBytes,
      keyImportParams,
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign(
      keyImportParams.name,
      cryptoKey,
      signBytes
    )

    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    const jwt = `${signInput}.${signatureBase64}`

    // Get access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token: ' + await tokenResponse.text())
    }

    const { access_token } = await tokenResponse.json()

    // Fetch data from Google Sheets
    console.log('Fetching data from Google Sheets...')
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'STUDIO 338 - 2025'!B:I`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${await response.text()}`)
    }

    const data = await response.json()
    const rows = data.values || []
    console.log(`Found ${rows.length} rows in Google Sheets`)

    const parseDate = (dateStr: string) => {
      try {
        // Expected format: "Friday January 10"
        const parts = dateStr.trim().split(' ')
        if (parts.length !== 3) {
          console.log('Invalid date format:', dateStr)
          return null
        }

        const day = parseInt(parts[2])
        const month = parts[1]
        const year = new Date().getFullYear()
        
        const dateString = `${month} ${day}, ${year}`
        const date = new Date(dateString)
        
        if (isNaN(date.getTime())) {
          console.log('Invalid date conversion:', dateString)
          return null
        }
        
        return date.toISOString().split('T')[0] // Returns YYYY-MM-DD
      } catch (error) {
        console.error('Date parsing error:', error)
        return null
      }
    }

    const events = rows.map((row: string[], index: number) => {
      console.log(`Processing row ${index}:`, row)

      const dateStr = row[0] // Column B
      const parsedDate = parseDate(dateStr)
      
      if (!parsedDate) {
        console.warn(`Invalid date format in row ${index}:`, dateStr)
        return null
      }

      const title = row[1] || '' // Column C
      const contractStatus = (row[7] || '').toLowerCase() // Column I

      return {
        date: parsedDate,
        title: title,
        status: contractStatus === 'yes' ? 'confirmed' : 'pending',
        is_recurring: false
      }
    }).filter(event => event !== null)

    if (events.length === 0) {
      throw new Error('No valid events found in the spreadsheet')
    }

    // Clear existing events
    console.log('Clearing existing events...')
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) {
      throw new Error(`Error deleting existing events: ${deleteError.message}`)
    }

    // Insert new events
    console.log('Inserting new events...')
    const { error: insertError } = await supabase
      .from('events')
      .insert(events)

    if (insertError) {
      throw new Error(`Error inserting new events: ${insertError.message}`)
    }

    console.log('Sync completed successfully')
    
    return new Response(
      JSON.stringify({ success: true, message: 'Events synced successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error syncing events:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
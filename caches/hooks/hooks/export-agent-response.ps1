# Exports each agent response to the agent-export Docker service on localhost:2030.
# Receives Cursor afterAgentResponse hook JSON on stdin.

$ErrorActionPreference = 'Stop'

function Write-HookLog {
    param([string]$Message)
    [Console]::Error.WriteLine("[export-agent-response] $Message")
}

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) {
        exit 0
    }

    $input = $raw | ConvertFrom-Json
    $text = [string]$input.text
    if ([string]::IsNullOrWhiteSpace($text)) {
        exit 0
    }

    $body = @{
        text = $text
        conversation_id = $input.conversation_id
        generation_id = $input.generation_id
        hook_event_name = $input.hook_event_name
        model = $input.model
        transcript_path = $input.transcript_path
        exported_at = (Get-Date).ToUniversalTime().ToString("o")
    } | ConvertTo-Json -Compress -Depth 4

    $uri = $env:AGENT_EXPORT_URL
    if ([string]::IsNullOrWhiteSpace($uri)) {
        $uri = "http://localhost:2030/api/agent-responses"
    }

    Invoke-RestMethod `
        -Uri $uri `
        -Method POST `
        -Body $body `
        -ContentType "application/json; charset=utf-8" `
        -TimeoutSec 5 | Out-Null
}
catch {
    # Fail open so agent replies are never blocked by export issues.
    Write-HookLog $_.Exception.Message
}

exit 0

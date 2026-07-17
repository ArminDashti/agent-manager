# Post-task verifier stop hook
# Emits followup_message to invoke post-task-verifier subagent after completed agent turns.

$ErrorActionPreference = 'Stop'

try {
    $inputText = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($inputText)) {
        Write-Output '{}'
        exit 0
    }

    $input = $inputText | ConvertFrom-Json

    # Only trigger on the first stop of a completed turn (avoid follow-up loops).
    $status = $input.status
    $loopCount = if ($null -ne $input.loop_count) { [int]$input.loop_count } else { 0 }

    if ($status -ne 'completed' -or $loopCount -ne 0) {
        Write-Output '{}'
        exit 0
    }

    # Allow opt-out via environment variable.
    $disabled = $env:POST_TASK_VERIFIER_DISABLED
    if ($disabled -eq '1' -or $disabled -eq 'true') {
        Write-Output '{}'
        exit 0
    }

    $followup = @{
        followup_message = @'
Invoke the `post-task-verifier` subagent now.

It must:
1. Classify whether this turn was question-only or a create/modify/delete task.
2. If question-only, skip verification and report that.
3. If action-based, extract the task goal, run real verification (commands/tests), and return a structured PASS/FAIL report with evidence.

Do not re-implement the task — only verify what was already done.
'@
    }

    Write-Output ($followup | ConvertTo-Json -Compress)
    exit 0
}
catch {
    Write-Error "[post-task-verifier-stop] $_"
    Write-Output '{}'
    exit 0
}
